const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Routes protégées par authentification et rôle admin
router.get('/users', auth, adminAuth, statsController.getUserStats);

module.exports = router;
