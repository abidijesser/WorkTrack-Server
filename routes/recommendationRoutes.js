const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Recommend members for a task based on skills
router.post('/members', recommendationController.recommendMembers);

module.exports = router;
