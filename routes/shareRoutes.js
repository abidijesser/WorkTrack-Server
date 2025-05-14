const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const downloadController = require('../controllers/downloadController');
const auth = require('../middleware/auth');

// Routes protégées par authentification
router.use(auth);

// Créer un lien de partage pour un document
router.post('/document/:documentId', shareController.createShareLink);

// Obtenir tous les liens de partage pour un document
router.get('/document/:documentId', shareController.getShareLinks);

// Désactiver un lien de partage
router.delete('/:token', shareController.deactivateShareLink);

// Envoyer un lien de partage par email
router.post('/:token/email', shareController.sendShareLinkByEmail);

// Routes publiques (pas besoin d'authentification)
router.use('/public', express.Router()
  // Valider un lien de partage
  .post('/validate/:token', shareController.validateShareLink)
  // Télécharger un document partagé
  .get('/download/:token', downloadController.downloadSharedDocument)
);

module.exports = router;
