const speakeasy = require('speakeasy');

// Fonction pour générer un secret 2FA
function generateSecret() {
  const secret = speakeasy.generateSecret({ length: 20 });
  console.log('Secret généré:');
  console.log('- Base32:', secret.base32);
  console.log('- Hex:', secret.hex);
  console.log('- URL d\'authentification:', secret.otpauth_url);
  return secret;
}

// Fonction pour générer un token TOTP
function generateToken(secret) {
  const token = speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  });
  console.log('Token généré:', token);
  return token;
}

// Fonction pour vérifier un token TOTP
function verifyToken(secret, token, window = 2) {
  console.log('Vérification du token:', token);
  console.log('Avec le secret:', secret);
  
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

// Fonction principale
function main() {
  // Remplacez cette valeur par le secret stocké dans la base de données
  // ou laissez vide pour générer un nouveau secret
  const existingSecret = process.argv[2] || '';
  
  let secret;
  if (existingSecret) {
    console.log('Utilisation du secret existant:', existingSecret);
    secret = existingSecret;
  } else {
    console.log('Génération d\'un nouveau secret...');
    secret = generateSecret().base32;
  }
  
  // Générer un token avec ce secret
  const token = generateToken(secret);
  
  // Vérifier le token
  verifyToken(secret, token);
  
  // Si un token est fourni en argument, le vérifier également
  const customToken = process.argv[3];
  if (customToken) {
    console.log('\nVérification du token personnalisé:', customToken);
    verifyToken(secret, customToken);
  }
}

// Exécuter le script
main();
