const axios = require('axios');

// Remplacez ce token par un token JWT valide d'un utilisateur connecté
const token = 'VOTRE_TOKEN_JWT_ICI';

// Test de la route generate-2fa
async function testGenerate2FA() {
  try {
    console.log('Testing generate-2fa route...');
    const response = await axios.post('http://localhost:3001/api/auth/generate-2fa', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error testing generate-2fa route:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    throw error;
  }
}

// Test de la route verify-2fa
async function testVerify2FA(verificationCode) {
  try {
    console.log('Testing verify-2fa route...');
    const response = await axios.post('http://localhost:3001/api/auth/verify-2fa', 
      { token: verificationCode },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error testing verify-2fa route:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    throw error;
  }
}

// Exécuter les tests
async function runTests() {
  try {
    // Test generate-2fa
    const generateResult = await testGenerate2FA();
    console.log('\nGenerate 2FA test completed successfully');
    
    // Si vous avez un code de vérification, vous pouvez tester verify-2fa
    // const verificationCode = 'YOUR_VERIFICATION_CODE';
    // await testVerify2FA(verificationCode);
    // console.log('\nVerify 2FA test completed successfully');
  } catch (error) {
    console.error('\nTests failed');
  }
}

runTests();
