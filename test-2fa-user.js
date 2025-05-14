require('dotenv').config();
const mongoose = require('mongoose');
const speakeasy = require('speakeasy');
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
    console.log('- Secret 2FA:', user.twoFactorSecret);
    
    return user;
  } catch (error) {
    console.error('Erreur lors de la recherche de l\'utilisateur:', error);
    return null;
  }
}

// Fonction pour générer un token TOTP pour un utilisateur
function generateTokenForUser(user) {
  if (!user.twoFactorSecret) {
    console.error('L\'utilisateur n\'a pas de secret 2FA');
    return null;
  }
  
  try {
    const token = speakeasy.totp({
      secret: user.twoFactorSecret,
      encoding: 'base32'
    });
    
    console.log('\nToken généré pour l\'utilisateur:', token);
    return token;
  } catch (error) {
    console.error('Erreur lors de la génération du token:', error);
    return null;
  }
}

// Fonction pour vérifier un token TOTP pour un utilisateur
function verifyTokenForUser(user, token) {
  if (!user.twoFactorSecret) {
    console.error('L\'utilisateur n\'a pas de secret 2FA');
    return false;
  }
  
  try {
    console.log('\nVérification du token:', token);
    console.log('Avec le secret:', user.twoFactorSecret);
    
    // Nettoyer le token (supprimer les espaces)
    const cleanToken = token.toString().replace(/\\s+/g, '');
    console.log('Token nettoyé:', cleanToken);
    
    // Vérifier avec différentes fenêtres de temps
    for (let window = 0; window <= 4; window++) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: cleanToken,
        window: window
      });
      
      console.log(`Vérification avec fenêtre ${window} (${window * 30} secondes): ${verified}`);
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    return false;
  }
}

// Fonction principale
async function main() {
  // Récupérer l'email depuis les arguments de la ligne de commande
  const email = process.argv[2];
  if (!email) {
    console.error('Erreur: Veuillez fournir un email en argument.');
    console.log('Usage: node test-2fa-user.js <email> [token]');
    process.exit(1);
  }
  
  // Connexion à la base de données
  await connectDB();
  
  // Trouver l'utilisateur
  const user = await findUserByEmail(email);
  if (!user) {
    process.exit(1);
  }
  
  // Générer un token pour l'utilisateur
  const generatedToken = generateTokenForUser(user);
  
  // Si un token est fourni en argument, le vérifier
  const customToken = process.argv[3];
  if (customToken) {
    verifyTokenForUser(user, customToken);
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
