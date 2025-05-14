const speakeasy = require('speakeasy');

// Fonction pour tester la vérification 2FA
function testVerify2FA(secret, token, window = 2) {
  console.log('Test de vérification 2FA');
  console.log('Secret:', secret);
  console.log('Token:', token);
  
  // Nettoyer le token (supprimer les espaces)
  const cleanToken = token.toString().replace(/\\s+/g, '');
  console.log('Token nettoyé:', cleanToken);
  
  // Vérifier le token avec différentes fenêtres de temps
  for (let i = 0; i <= window; i++) {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: cleanToken,
      window: i
    });
    
    console.log(`Vérification avec fenêtre ${i} (${i * 30} secondes): ${verified}`);
  }
  
  // Vérification standard
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: cleanToken,
    window: window
  });
  
  console.log(`Résultat final de la vérification (fenêtre ${window}): ${verified}`);
  return verified;
}

// Exemple d'utilisation
// Remplacez ces valeurs par les vôtres
const secret = 'VOTRE_SECRET_BASE32'; // Le secret stocké dans la base de données
const token = 'CODE_A_6_CHIFFRES'; // Le code généré par l'application d'authentification

// Tester la vérification
testVerify2FA(secret, token);
