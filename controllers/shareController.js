const shareService = require('../services/shareService');
const Document = require('../models/Document');

// Créer un lien de partage pour un document
const createShareLink = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { expiresIn, accessLevel, password } = req.body;

    // Vérifier si le document existe
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    // Créer le lien de partage
    const shareLink = await shareService.createShareLink(
      documentId,
      req.user.id,
      { expiresIn, accessLevel, password }
    );

    // Construire l'URL complète du lien de partage
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared-document/${shareLink.token}`;

    res.status(201).json({
      success: true,
      data: {
        ...shareLink,
        url: shareUrl
      }
    });
  } catch (error) {
    console.error('Erreur lors de la création du lien de partage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la création du lien de partage'
    });
  }
};

// Obtenir tous les liens de partage pour un document
const getShareLinks = async (req, res) => {
  try {
    const { documentId } = req.params;

    // Vérifier si le document existe
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    // Récupérer les liens de partage
    const shareLinks = await shareService.getShareLinksForDocument(documentId, req.user.id);

    // Construire les URLs complètes pour chaque lien
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const shareLinksWithUrls = shareLinks.map(link => {
      // Convertir en objet simple si c'est un document Mongoose, sinon utiliser directement
      const linkObj = link.toObject ? link.toObject() : { ...link };
      return {
        ...linkObj,
        url: `${baseUrl}/shared-document/${link.token}`
      };
    });

    res.status(200).json({
      success: true,
      data: shareLinksWithUrls
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des liens de partage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la récupération des liens de partage'
    });
  }
};

// Désactiver un lien de partage
const deactivateShareLink = async (req, res) => {
  try {
    const { token } = req.params;

    // Désactiver le lien
    await shareService.deactivateShareLink(token, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Lien de partage désactivé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la désactivation du lien de partage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la désactivation du lien de partage'
    });
  }
};

// Valider un lien de partage
const validateShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Récupérer les informations de la requête pour la journalisation
    const requestInfo = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown'
    };

    // Valider le lien
    const result = await shareService.validateShareLink(token, password, requestInfo);

    if (!result.valid && result.requiresPassword) {
      return res.status(401).json({
        success: false,
        requiresPassword: true,
        error: 'Ce lien est protégé par un mot de passe'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        document: result.document,
        accessLevel: result.accessLevel,
        // Ajouter des informations de sécurité pour le client
        securityInfo: {
          originalType: result.document.fileType,
          isReadOnly: result.accessLevel === 'view',
          canComment: ['comment', 'edit', 'admin'].includes(result.accessLevel),
          canEdit: ['edit', 'admin'].includes(result.accessLevel)
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation du lien de partage:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Lien de partage invalide'
    });
  }
};

// Envoyer un lien de partage par email
const sendShareLinkByEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const { recipientEmail, recipientName, message, documentName } = req.body;

    // Vérifier si l'email du destinataire est fourni
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'L\'adresse email du destinataire est requise'
      });
    }

    // Envoyer l'email
    await shareService.sendShareLinkByEmail(
      token,
      { recipientEmail, recipientName, message, documentName },
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: 'Lien de partage envoyé par email avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du lien de partage par email:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'envoi du lien de partage par email'
    });
  }
};

module.exports = {
  createShareLink,
  getShareLinks,
  deactivateShareLink,
  validateShareLink,
  sendShareLinkByEmail
};
