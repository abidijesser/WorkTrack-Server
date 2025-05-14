require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');

// Connexion à la base de données
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connexion à MongoDB établie');
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
}

// Fonction pour trouver un utilisateur par email
async function findUserByEmail(email) {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`Aucun utilisateur trouvé avec l'email: ${email}`);
      return null;
    }
    
    console.log('Utilisateur trouvé:');
    console.log('- ID:', user._id);
    console.log('- Nom:', user.name);
    console.log('- Email:', user.email);
    console.log('- 2FA activé:', user.twoFactorEnabled);
    
    return user;
  } catch (error) {
    console.error('Erreur lors de la recherche de l\'utilisateur:', error);
    return null;
  }
}

// Fonction pour générer un token JWT
function generateToken(userId) {
  try {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });
    
    console.log('Token JWT généré:', token);
    return token;
  } catch (error) {
    console.error('Erreur lors de la génération du token JWT:', error);
    return null;
  }
}

// Fonction pour vérifier un token JWT
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token JWT vérifié avec succès:');
    console.log('- ID utilisateur:', decoded.id);
    console.log('- Date d\'émission:', new Date(decoded.iat * 1000).toLocaleString());
    console.log('- Date d\'expiration:', new Date(decoded.exp * 1000).toLocaleString());
    return decoded;
  } catch (error) {
    console.error('Erreur lors de la vérification du token JWT:', error);
    return null;
  }
}

// Fonction principale
async function main() {
  // Récupérer l'email depuis les arguments de la ligne de commande
  const email = process.argv[2];
  if (!email) {
    console.error('Erreur: Veuillez fournir un email en argument.');
    console.log('Usage: node test-auth-middleware.js <email>');
    process.exit(1);
  }
  
  // Connexion à la base de données
  await connectDB();
  
  // Trouver l'utilisateur
  const user = await findUserByEmail(email);
  if (!user) {
    process.exit(1);
  }
  
  // Générer un token JWT pour l'utilisateur
  const token = generateToken(user._id);
  if (!token) {
    process.exit(1);
  }
  
  // Vérifier le token JWT
  const decoded = verifyToken(token);
  if (!decoded) {
    process.exit(1);
  }
  
  // Fermer la connexion à la base de données
  await mongoose.connection.close();
  console.log('\nConnexion à MongoDB fermée');
}

// Exécuter le script
main().catch(error => {
  console.error('Erreur dans le script principal:', error);
  mongoose.connection.close();
  process.exit(1);
});
