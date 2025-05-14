const Document = require("../models/Document");
const User = require("../models/User");
const Project = require("../models/Project");
const Comment = require("../models/Comment");
const notificationService = require("../services/notificationService");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Get all documents (with optional filtering)
const getAllDocuments = async (req, res) => {
  try {
    const { projectId, userId, type } = req.query;
    const query = {};

    // Add filters if provided
    if (projectId) query.project = projectId;
    if (userId) query.uploadedBy = userId;
    if (type) query.fileType = type;

    // Get documents with permissions for the current user
    const documents = await Document.find({
      $or: [
        { uploadedBy: req.user.id }, // Documents uploaded by the user
        { isPublic: true }, // Public documents
        { "permissions.user": req.user.id }, // Documents with explicit permissions
        // If the user is part of a project, include all documents from that project
        {
          project: {
            $in: await Project.find({ members: req.user.id }).distinct("_id"),
          },
        },
      ],
      ...query,
    })
      .populate("uploadedBy", "name email")
      .populate("project", "name")
      .sort({ uploadedDate: -1 });

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Get a single document by ID
const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate("uploadedBy", "name email")
      .populate("project", "name")
      .populate({
        path: "versions.uploadedBy",
        select: "name email",
      })
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name email",
        },
      });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to view this document
    const hasPermission =
      document.uploadedBy._id.toString() === req.user.id ||
      document.isPublic ||
      document.permissions.some(
        (p) =>
          p.user.toString() === req.user.id &&
          ["view", "edit", "admin"].includes(p.access)
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to view this document",
      });
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Create a new document
const createDocument = async (req, res) => {
  try {
    // File should be uploaded via multer middleware
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    const { name, description, project, isPublic } = req.body;

    // Générer un identifiant unique pour ce document
    const uniqueId = crypto.randomUUID();

    // Générer un ID d'affichage court et lisible avec un timestamp pour garantir l'unicité
    const timestamp = new Date().getTime().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const displayId = `DOC-${timestamp}-${randomPart}`;

    console.log(`Création d'un nouveau document avec uniqueId: ${uniqueId} et displayId: ${displayId}`);

    // Ajouter un suffixe au nom du document pour indiquer qu'il s'agit d'un duplicata si nécessaire
    let documentName = name || req.file.originalname;

    // Vérifier si un document avec le même nom existe déjà
    const existingDocuments = await Document.find({
      name: new RegExp(`^${documentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\(\\d+\\))?$`),
      uploadedBy: req.user.id
    });

    if (existingDocuments.length > 0) {
      // Ajouter un suffixe numérique au nom du document
      documentName = `${documentName} (${existingDocuments.length})`;
      console.log(`Document avec le même nom trouvé, renommé en: ${documentName}`);
    }

    // Create document record
    const document = await Document.create({
      uniqueId,
      displayId,
      name: documentName, // Utiliser le nom modifié qui inclut un suffixe pour les duplicatas
      description,
      filePath: req.file.path,
      fileType: path.extname(req.file.originalname).substring(1),
      fileSize: req.file.size,
      project: project || null,
      uploadedBy: req.user.id,
      isPublic: isPublic === "true",
    });

    // Créer une notification pour le nouveau document
    try {
      await notificationService.createDocumentNotification(
        document,
        "document_uploaded",
        req.user
      );
      console.log("Document upload notification created successfully");
    } catch (notificationError) {
      console.error(
        "Error creating document upload notification:",
        notificationError
      );
      // Continue despite notification error
    }

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error creating document:", error);

    // If there was an error, remove the uploaded file
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Update document details
const updateDocument = async (req, res) => {
  try {
    let document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to edit this document
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.permissions.some(
        (p) =>
          p.user.toString() === req.user.id &&
          ["edit", "admin"].includes(p.access)
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to update this document",
      });
    }

    // Update document
    const { name, description, project, isPublic, pinned } = req.body;

    document = await Document.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        project,
        isPublic,
        pinned,
        lastModified: Date.now(),
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to delete this document
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.permissions.some(
        (p) => p.user.toString() === req.user.id && p.access === "admin"
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to delete this document",
      });
    }

    // Delete file from storage
    fs.unlink(document.filePath, async (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      }

      // Delete document from database
      await Document.deleteOne({ _id: document._id });

      res.status(200).json({
        success: true,
        data: {},
      });
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Get document permissions
const getPermissions = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate({
      path: "permissions.user",
      select: "name email",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to view this document
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.permissions.some((p) => p.user._id.toString() === req.user.id) ||
      document.isPublic;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to view this document",
      });
    }

    res.status(200).json({
      success: true,
      data: document.permissions,
    });
  } catch (error) {
    console.error("Error getting permissions:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Update document permissions
const updatePermissions = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to manage permissions
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.permissions.some(
        (p) => p.user.toString() === req.user.id && p.access === "admin"
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to manage document permissions",
      });
    }

    const { userId, access } = req.body;

    // Validate user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update permissions
    const permissionIndex = document.permissions.findIndex(
      (p) => p.user.toString() === userId
    );

    if (permissionIndex > -1) {
      // Update existing permission
      document.permissions[permissionIndex].access = access;
    } else {
      // Add new permission
      document.permissions.push({
        user: userId,
        access,
      });
    }

    await document.save();

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error updating permissions:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Upload a new version of a document
const uploadNewVersion = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to edit this document
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.permissions.some(
        (p) =>
          p.user.toString() === req.user.id &&
          ["edit", "admin"].includes(p.access)
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to update this document",
      });
    }

    // File should be uploaded via multer middleware
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    // Vérifier que le type de fichier est le même que l'original
    const originalFileType = document.fileType;
    const newFileType = path.extname(req.file.originalname).substring(1);

    if (originalFileType.toLowerCase() !== newFileType.toLowerCase()) {
      // Supprimer le fichier téléchargé
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });

      return res.status(400).json({
        success: false,
        error: `Le type de fichier doit être le même que l'original (${originalFileType}). Vous avez téléchargé un fichier de type ${newFileType}.`,
      });
    }

    // Générer un identifiant unique pour cette version
    const versionUniqueId = crypto.randomUUID();

    // Add current version to versions array
    document.versions.push({
      uniqueId: versionUniqueId,
      filePath: document.filePath,
      fileSize: document.fileSize,
      fileType: document.fileType,
      uploadedBy: document.uploadedBy,
      uploadedDate: document.uploadedDate,
      comment: req.body.comment || "Previous version",
    });

    // Update document with new file
    document.filePath = req.file.path;
    document.fileSize = req.file.size;
    document.lastModified = Date.now();
    document.uploadedDate = Date.now();

    await document.save();

    // Créer une notification pour la nouvelle version du document
    try {
      await notificationService.createDocumentVersionNotification(
        document,
        req.user
      );
      console.log("Document version notification created successfully");
    } catch (notificationError) {
      console.error(
        "Error creating document version notification:",
        notificationError
      );
      // Continue despite notification error
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error uploading new version:", error);

    // If there was an error, remove the uploaded file
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Toggle pin status
const togglePin = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Check if user has permission to edit this document
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.permissions.some(
        (p) =>
          p.user.toString() === req.user.id &&
          ["edit", "admin"].includes(p.access)
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to pin/unpin this document",
      });
    }

    // Toggle pin status
    document.pinned = !document.pinned;
    await document.save();

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error toggling pin status:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Télécharger un document
const downloadDocument = async (req, res) => {
  try {
    console.log(
      "Demande de téléchargement pour le document ID:",
      req.params.id
    );

    const document = await Document.findById(req.params.id);

    if (!document) {
      console.log("Document non trouvé:", req.params.id);
      return res.status(404).json({
        success: false,
        error: "Document non trouvé",
      });
    }

    console.log("Document trouvé:", document.name);
    console.log("Chemin du fichier:", document.filePath);

    // Vérifier si l'utilisateur a la permission de voir ce document
    // Temporairement, permettre à tous les utilisateurs de télécharger les documents
    const hasPermission = true;

    // Ancienne vérification des permissions (commentée pour le moment)
    /*
    const hasPermission =
      document.uploadedBy.toString() === req.user.id ||
      document.isPublic ||
      document.permissions.some(
        (p) => p.user.toString() === req.user.id && ["view", "edit", "admin"].includes(p.access)
      );
    */

    if (!hasPermission) {
      console.log("Permission refusée pour l'utilisateur:", req.user.id);
      return res.status(403).json({
        success: false,
        error: "Vous n'avez pas la permission de télécharger ce document",
      });
    }

    // Vérifier si le fichier existe
    if (!fs.existsSync(document.filePath)) {
      console.log("Fichier non trouvé sur le disque:", document.filePath);

      // Essayer de résoudre le chemin relatif
      const absolutePath = path.resolve(document.filePath);
      console.log("Tentative avec le chemin absolu:", absolutePath);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({
          success: false,
          error: "Fichier non trouvé sur le serveur",
        });
      }

      // Si le fichier existe avec le chemin absolu, utiliser ce chemin
      document.filePath = absolutePath;
    }

    // Extraire le nom de fichier original et l'extension
    const fileName = document.name;
    const fileExt = path.extname(document.filePath);

    // S'assurer que le nom du fichier a la bonne extension
    const fullFileName = fileName.endsWith(fileExt)
      ? fileName
      : `${fileName}${fileExt}`;

    console.log("Envoi du fichier:", document.filePath);
    console.log("Nom du fichier pour le téléchargement:", fullFileName);

    // Enregistrer l'action de téléchargement dans le journal d'accès (si nécessaire)
    // Vous pourriez ajouter ici un code pour enregistrer les statistiques de téléchargement

    // Envoyer le fichier avec le nom original
    res.download(document.filePath, fullFileName);
  } catch (error) {
    console.error("Erreur lors du téléchargement du document:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur: " + error.message,
    });
  }
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  getPermissions,
  updatePermissions,
  uploadNewVersion,
  togglePin,
  downloadDocument,
};
