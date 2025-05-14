const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const auth = require("../middleware/auth");
const { uploadDocument, uploadDocumentVersion } = require("../utils/fileUpload");

// Apply auth middleware to all routes
router.use(auth);

// Get all documents (with optional filtering)
router.get("/", documentController.getAllDocuments);

// Get a single document by ID
router.get("/:id", documentController.getDocumentById);

// Create a new document
router.post("/", (req, res, next) => {
  uploadDocument(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next();
  });
}, documentController.createDocument);

// Update document details
router.put("/:id", documentController.updateDocument);

// Delete document
router.delete("/:id", documentController.deleteDocument);

// Get document permissions
router.get("/:id/permissions", documentController.getPermissions);

// Update document permissions
router.put("/:id/permissions", documentController.updatePermissions);

// Upload a new version of a document
router.post("/:id/versions", (req, res, next) => {
  uploadDocumentVersion(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next();
  });
}, documentController.uploadNewVersion);

// Toggle pin status
router.put("/:id/pin", documentController.togglePin);

// Télécharger un document
router.get("/:id/download", documentController.downloadDocument);

module.exports = router;
