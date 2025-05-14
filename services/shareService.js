const crypto = require("crypto");
const ShareLink = require("../models/ShareLink");
const Document = require("../models/Document");
const User = require("../models/User");
const transporter = require("../config/emailConfig");

// Générer un token unique pour le lien de partage
const generateShareToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Créer un lien de partage pour un document
const createShareLink = async (documentId, userId, options = {}) => {
  try {
    // Vérifier si le document existe
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error("Document non trouvé");
    }

    // Vérifier si l'utilisateur a le droit de partager ce document
    const hasPermission =
      document.uploadedBy.toString() === userId ||
      document.permissions.some(
        (p) =>
          p.user.toString() === userId && ["edit", "admin"].includes(p.access)
      );

    if (!hasPermission) {
      throw new Error("Vous n'avez pas la permission de partager ce document");
    }

    // Configurer les options de partage
    const { expiresIn, accessLevel = "view", password = null } = options;

    // Calculer la date d'expiration si fournie
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
    }

    // Générer un token unique
    const token = generateShareToken();

    // Ajouter des métadonnées de sécurité
    const securityMetadata = {
      originalFileType: document.fileType,
      originalFileSize: document.fileSize,
      originalFileName: document.name,
      originalChecksum: crypto
        .createHash("md5")
        .update(document.filePath)
        .digest("hex"),
      createdAt: new Date(),
      userAgent: options.userAgent || "Unknown",
      ipAddress: options.ipAddress || "Unknown",
    };

    // Créer le lien de partage dans la base de données
    const shareLink = new ShareLink({
      document: documentId,
      createdBy: userId,
      token,
      expiresAt,
      accessLevel,
      password: password
        ? crypto.createHash("sha256").update(password).digest("hex")
        : null,
      isActive: true,
      securityMetadata,
    });

    await shareLink.save();

    return {
      token,
      expiresAt,
      accessLevel,
      isPasswordProtected: !!password,
    };
  } catch (error) {
    console.error("Erreur lors de la création du lien de partage:", error);
    throw error;
  }
};

// Vérifier si un lien de partage est valide
const validateShareLink = async (token, password = null, requestInfo = {}) => {
  try {
    // Trouver le lien de partage par token
    const shareLink = await ShareLink.findOne({ token }).populate("document");

    // Préparer les informations de la requête pour le journal d'accès
    const { ipAddress = "Unknown", userAgent = "Unknown" } = requestInfo;
    const logEntry = {
      timestamp: new Date(),
      ipAddress,
      userAgent,
      success: false,
    };

    if (!shareLink) {
      // Enregistrer la tentative d'accès échouée (si possible)
      try {
        // Nous ne pouvons pas enregistrer dans shareLink car il n'existe pas,
        // mais nous pourrions enregistrer dans un journal d'accès global si nécessaire
      } catch (logError) {
        console.error(
          "Erreur lors de l'enregistrement de la tentative d'accès:",
          logError
        );
      }

      throw new Error("Lien de partage invalide ou expiré");
    }

    // Vérifier si le lien est actif
    if (!shareLink.isActive) {
      logEntry.action = "view";
      logEntry.success = false;
      shareLink.accessLog.push(logEntry);
      await shareLink.save();

      throw new Error("Ce lien de partage a été désactivé");
    }

    // Vérifier si le lien a expiré
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      logEntry.action = "view";
      logEntry.success = false;
      shareLink.accessLog.push(logEntry);

      shareLink.isActive = false;
      await shareLink.save();

      throw new Error("Ce lien de partage a expiré");
    }

    // Vérifier le mot de passe si nécessaire
    if (shareLink.password) {
      if (!password) {
        logEntry.action = "password_attempt";
        logEntry.success = false;
        shareLink.accessLog.push(logEntry);
        await shareLink.save();

        return {
          valid: false,
          requiresPassword: true,
          document: null,
          accessLevel: null,
        };
      }

      logEntry.action = "password_attempt";

      const hashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
      if (hashedPassword !== shareLink.password) {
        logEntry.action = "password_fail";
        logEntry.success = false;
        shareLink.accessLog.push(logEntry);
        await shareLink.save();

        throw new Error("Mot de passe incorrect");
      }

      // Mot de passe correct
      logEntry.action = "password_success";
      logEntry.success = true;
    } else {
      // Pas de mot de passe requis
      logEntry.action = "view";
      logEntry.success = true;
    }

    // Vérifier l'intégrité du document si des métadonnées de sécurité sont disponibles
    if (shareLink.securityMetadata && shareLink.document) {
      const document = shareLink.document;

      // Vérifier que le type de fichier n'a pas changé
      if (shareLink.securityMetadata.originalFileType !== document.fileType) {
        logEntry.success = false;
        shareLink.accessLog.push(logEntry);
        await shareLink.save();

        throw new Error(
          "L'intégrité du document a été compromise: le type de fichier a changé"
        );
      }

      // Vérifier que le nom du fichier n'a pas changé
      if (shareLink.securityMetadata.originalFileName !== document.name) {
        console.warn(
          "Le nom du document a changé depuis la création du lien de partage"
        );
        // On ne bloque pas l'accès pour un changement de nom, mais on le note
      }
    }

    // Incrémenter le compteur de vues et enregistrer l'accès
    shareLink.viewCount += 1;
    shareLink.accessLog.push(logEntry);
    await shareLink.save();

    return {
      valid: true,
      requiresPassword: false,
      document: shareLink.document,
      accessLevel: shareLink.accessLevel,
    };
  } catch (error) {
    console.error("Erreur lors de la validation du lien de partage:", error);
    throw error;
  }
};

// Désactiver un lien de partage
const deactivateShareLink = async (token, userId) => {
  try {
    const shareLink = await ShareLink.findOne({ token });

    if (!shareLink) {
      throw new Error("Lien de partage non trouvé");
    }

    // Vérifier si l'utilisateur a le droit de désactiver ce lien
    if (shareLink.createdBy.toString() !== userId) {
      throw new Error("Vous n'avez pas la permission de désactiver ce lien");
    }

    shareLink.isActive = false;
    await shareLink.save();

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la désactivation du lien de partage:", error);
    throw error;
  }
};

// Obtenir tous les liens de partage pour un document
const getShareLinksForDocument = async (documentId, userId) => {
  try {
    const document = await Document.findById(documentId);

    if (!document) {
      throw new Error("Document non trouvé");
    }

    // Temporairement, permettre à tous les utilisateurs de voir les liens de partage
    const hasPermission = true;

    // Ancienne vérification des permissions (commentée pour le moment)
    /*
    const hasPermission =
      document.uploadedBy.toString() === userId ||
      document.permissions.some(p =>
        p.user.toString() === userId &&
        ['edit', 'admin'].includes(p.access)
      );

    if (!hasPermission) {
      throw new Error('Vous n\'avez pas la permission de voir les liens de partage pour ce document');
    }
    */

    const shareLinks = await ShareLink.find({
      document: documentId,
      isActive: true,
    }).sort({ createdAt: -1 });

    // Maintenant que nous avons supprimé les statistiques, retournons simplement les liens
    return shareLinks;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des liens de partage:",
      error
    );
    throw error;
  }
};

// Envoyer un email avec le lien de partage
const sendShareLinkByEmail = async (shareToken, emailData, userId) => {
  try {
    const { recipientEmail, recipientName, message, documentName } = emailData;

    // Vérifier si le lien de partage existe
    const shareLink = await ShareLink.findOne({ token: shareToken });
    if (!shareLink) {
      throw new Error("Lien de partage non trouvé");
    }

    // Vérifier si l'utilisateur a le droit d'envoyer ce lien
    if (shareLink.createdBy.toString() !== userId) {
      throw new Error("Vous n'avez pas la permission d'envoyer ce lien");
    }

    // Récupérer les informations de l'expéditeur
    const sender = await User.findById(userId);
    if (!sender) {
      throw new Error("Utilisateur non trouvé");
    }

    // Construire l'URL du lien de partage
    const baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/shared-document/${shareToken}`;

    // Construire le contenu de l'email
    const emailSubject = `${sender.name} a partagé un document avec vous: ${documentName}`;

    let emailBody = `Bonjour ${recipientName || "utilisateur"},\n\n`;
    emailBody += `${sender.name} (${sender.email}) a partagé un document avec vous: ${documentName}.\n\n`;

    if (message) {
      emailBody += `Message de ${sender.name}:\n${message}\n\n`;
    }

    emailBody += `Vous pouvez accéder au document en cliquant sur le lien suivant:\n${shareUrl}\n\n`;

    if (shareLink.expiresAt) {
      emailBody += `Ce lien expirera le ${shareLink.expiresAt.toLocaleString()}.\n\n`;
    }

    if (shareLink.password) {
      emailBody += `Ce lien est protégé par un mot de passe. Veuillez contacter ${sender.name} pour obtenir le mot de passe.\n\n`;
    }

    emailBody += `Cordialement,\nL'équipe de gestion de projet`;

    // Envoyer l'email
    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to: recipientEmail,
      subject: emailSubject,
      text: emailBody,
    });

    // Mettre à jour les statistiques du lien de partage
    shareLink.emailsSent += 1;
    await shareLink.save();

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email de partage:", error);
    throw error;
  }
};

module.exports = {
  createShareLink,
  validateShareLink,
  deactivateShareLink,
  getShareLinksForDocument,
  sendShareLinkByEmail,
};
