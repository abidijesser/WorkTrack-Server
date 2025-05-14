const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Connexion à la base de données
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connecté à la base de données'))
  .catch(err => {
    console.error('Erreur de connexion à la base de données:', err);
    process.exit(1);
  });

// Fonction pour tester les routes de notification
async function testNotificationRoutes() {
  try {
    // 1. Créer un utilisateur de test
    const User = require('./models/User');
    const user = await User.findOne();
    
    if (!user) {
      console.error('Aucun utilisateur trouvé dans la base de données');
      return;
    }
    
    console.log('Utilisateur trouvé:', user._id);
    
    // 2. Créer un token JWT valide
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'votre_secret_jwt',
      { expiresIn: '1h' }
    );
    
    console.log('Token JWT créé:', token);
    
    // 3. Créer une notification de test
    const Notification = require('./models/Notification');
    const notification = new Notification({
      recipient: user._id,
      type: 'task_created',
      message: 'Ceci est une notification de test',
      read: false
    });
    
    await notification.save();
    console.log('Notification de test créée:', notification._id);
    
    // 4. Tester la route GET /api/notifications
    const response = await axios.get('http://localhost:3001/api/notifications', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Réponse de la route GET /api/notifications:', response.data);
    
    // 5. Tester la route PUT /api/notifications/:id/read
    if (response.data.notifications && response.data.notifications.length > 0) {
      const notificationId = response.data.notifications[0]._id;
      const updateResponse = await axios.put(`http://localhost:3001/api/notifications/${notificationId}/read`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Réponse de la route PUT /api/notifications/:id/read:', updateResponse.data);
    }
    
    console.log('Tests terminés avec succès');
  } catch (error) {
    console.error('Erreur lors des tests:', error.response ? error.response.data : error.message);
  } finally {
    mongoose.disconnect();
  }
}

// Exécuter les tests
testNotificationRoutes(); 