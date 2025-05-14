const speakeasy = require('speakeasy');

// Fonction pour générer un token TOTP à partir d'un secret spécifique
function generateTokenFromSecret(secret) {
  try {
    const token = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });
    console.log('Secret utilisé:', secret);
    console.log('Token généré:', token);
    return token;
  } catch (error) {
    console.error('Erreur lors de la génération du token:', error);
    return null;
  }
}

// Fonction pour vérifier un token TOTP avec un secret spécifique
function verifyTokenWithSecret(secret, token) {
  try {
    console.log('\nVérification du token:', token);
    console.log('Avec le secret:', secret);
    
    // Nettoyer le token (supprimer les espaces)
    const cleanToken = token.toString().replace(/\\s+/g, '');
    console.log('Token nettoyé:', cleanToken);
    
    // Vérifier avec différentes fenêtres de temps
    for (let window = 0; window <= 4; window++) {
      const verified = speakeasy.totp.verify({
        secret: secret,
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
function main() {
  // Récupérer le secret depuis les arguments de la ligne de commande
  const secret = process.argv[2];
  if (!secret) {
    console.error('Erreur: Veuillez fournir un secret en argument.');
    console.log('Usage: node test-2fa-specific.js <secret> [token]');
    process.exit(1);
  }
  
  // Générer un token avec ce secret
  const generatedToken = generateTokenFromSecret(secret);
  
  // Si un token est fourni en argument, le vérifier
  const customToken = process.argv[3];
  if (customToken) {
    verifyTokenWithSecret(secret, customToken);
  }
}

// Exécuter le script
main();
