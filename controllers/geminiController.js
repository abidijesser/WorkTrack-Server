const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the Google Generative AI with your API key
// Créer deux instances, une pour chaque version de l'API
const genAIv1 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  apiVersion: "v1"
});

const genAIv1beta = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  apiVersion: "v1beta"
});

// Instance par défaut
const genAI = genAIv1;

// Fonction pour obtenir un modèle Gemini disponible
const getAvailableModel = async () => {
  // Liste des modèles à essayer dans l'ordre (mise à jour avec les modèles les plus récents)
  const modelOptions = [
    // Modèles Gemini 1.5
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    // Modèles Gemini 1.0
    'gemini-pro',
    'gemini-1.0-pro',
    // Formats alternatifs
    'models/gemini-pro',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-pro',
    // Essayer sans préfixe
    'text-bison',
    'chat-bison',
    // Modèles PaLM
    'models/text-bison-001',
    'models/chat-bison-001'
  ];

  // Essayer d'abord avec l'API v1
  for (const modelName of modelOptions) {
    try {
      console.log(`Trying model with v1 API: ${modelName}`);
      const model = genAIv1.getGenerativeModel({ model: modelName });
      // Tester le modèle avec une requête simple
      await model.generateContent('Test');
      console.log(`Model ${modelName} is available with v1 API`);
      return { success: true, model, modelName, apiVersion: 'v1' };
    } catch (error) {
      console.error(`Model ${modelName} with v1 API failed:`, error.message);
    }
  }

  // Si aucun modèle ne fonctionne avec v1, essayer avec v1beta
  for (const modelName of modelOptions) {
    try {
      console.log(`Trying model with v1beta API: ${modelName}`);
      const model = genAIv1beta.getGenerativeModel({ model: modelName });
      // Tester le modèle avec une requête simple
      await model.generateContent('Test');
      console.log(`Model ${modelName} is available with v1beta API`);
      return { success: true, model, modelName, apiVersion: 'v1beta' };
    } catch (error) {
      console.error(`Model ${modelName} with v1beta API failed:`, error.message);
    }
  }

  return { success: false, error: 'No available Gemini models found with either v1 or v1beta API' };
};

// Vérifier que la clé API est configurée
const checkAPIKey = () => {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in .env file');
    return false;
  }

  if (process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.error('GEMINI_API_KEY is set to the default placeholder value. Please update it with your actual API key.');
    return false;
  }

  console.log('GEMINI_API_KEY is properly configured');
  return true;
};

// Fonction pour tester la connexion à l'API Gemini
const testGeminiConnection = async () => {
  try {
    console.log('Testing Gemini API connection...');

    // Vérifier la clé API
    if (!checkAPIKey()) {
      throw new Error('Invalid or missing API key configuration');
    }

    console.log('API Key:', process.env.GEMINI_API_KEY ? 'API key is set' : 'API key is missing');

    const { success, model, modelName, apiVersion, error } = await getAvailableModel();

    if (!success) {
      throw new Error(error);
    }

    console.log(`Using model: ${modelName} with API version: ${apiVersion}`);
    const result = await model.generateContent('Hello, can you hear me?');
    const response = result.response;
    const text = response.text();

    console.log('Gemini API test successful. Response:', text);
    return { success: true, message: text, modelName, apiVersion };
  } catch (error) {
    console.error('Gemini API test failed:', error);
    return { success: false, error: error.message };
  }
};

// Exécuter le test au démarrage
testGeminiConnection();

/**
 * Process a message with Gemini and return the response
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
const processGeminiMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Obtenir un modèle disponible
    const { success, model, modelName, apiVersion, error } = await getAvailableModel();

    if (!success) {
      throw new Error(error);
    }

    console.log(`Using model ${modelName} with API version ${apiVersion} for message processing`);

    // Configurer les options de génération
    const generationConfig = {
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    };

    // Préparer le contenu de la requête
    const prompt = message;

    // Generate content - format simple pour le débogage
    const result = await model.generateContent(prompt);

    const response = result.response;
    const text = response.text();

    return res.status(200).json({
      content: text,
      timestamp: new Date(),
      type: 'bot',
      modelUsed: modelName,
      apiVersion: apiVersion
    });
  } catch (error) {
    console.error('Error processing message with Gemini:', error);
    console.log('API Key used:', process.env.GEMINI_API_KEY ? 'API key is set' : 'API key is missing');
    console.log('Message sent:', message);

    return res.status(500).json({
      error: 'Error processing message with Gemini',
      details: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
};

/**
 * Test the Gemini API connection
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
const testGeminiAPI = async (req, res) => {
  try {
    const result = await testGeminiConnection();
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error testing Gemini API:', error);
    return res.status(500).json({
      success: false,
      error: 'Error testing Gemini API',
      details: error.message
    });
  }
};

module.exports = {
  processGeminiMessage,
  testGeminiAPI
};
