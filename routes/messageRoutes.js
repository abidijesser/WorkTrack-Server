const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Get messages for a specific room
router.get('/room/:room', messageController.getRoomMessages);

// Create a new message
router.post('/', messageController.createMessage);

module.exports = router;
