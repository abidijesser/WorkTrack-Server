const express = require('express');
const router = express.Router();
const { processGeminiMessage, testGeminiAPI } = require('../controllers/geminiController');

// Route to process messages with Gemini
router.post('/', processGeminiMessage);

// Route de test pour vérifier que l'API Gemini est accessible
router.get('/test', (req, res) => {
  res.status(200).json({
    message: 'Gemini API route is working',
    apiKeyConfigured: process.env.GEMINI_API_KEY ? true : false
  });
});

// Route pour tester la connexion à l'API Gemini
router.get('/test-connection', testGeminiAPI);

module.exports = router;
