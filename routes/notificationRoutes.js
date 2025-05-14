const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// Routes protégées par authentification
router.use(auth);

// Obtenir les notifications de l'utilisateur
router.get('/', notificationController.getUserNotifications);

// Marquer une notification comme lue
router.put('/:notificationId/read', notificationController.markNotificationAsRead);

module.exports = router; 