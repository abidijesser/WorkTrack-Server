const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const mongoose = require('mongoose');
require('dotenv').config();

// Créer une application Express
const app = express();

// Middleware
app.use(bodyParser.json());

// Route de test pour generate-2fa
app.post('/api/auth/generate-2fa', (req, res) => {
  try {
    console.log('generate-2fa - Request received');
    
    // Générer un secret pour 2FA
    const secret = speakeasy.generateSecret({ length: 20 });
    console.log('generate-2fa - Secret generated:', secret.base32);
    
    // Générer un QR code
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        console.error('generate-2fa - Error generating QR code:', err);
        return res.status(500).json({ success: false, error: 'Error generating QR code' });
      }
      
      console.log('generate-2fa - QR code generated successfully');
      res.json({ success: true, qrCode: data_url, secret: secret.base32 });
    });
  } catch (error) {
    console.error('generate-2fa - Error:', error);
    res.status(500).json({ success: false, error: 'Error generating 2FA setup' });
  }
});

// Route de test pour verify-2fa
app.post('/api/auth/verify-2fa', (req, res) => {
  try {
    console.log('verify-2fa - Request received');
    const { token, secret } = req.body;
    
    if (!token || !secret) {
      return res.status(400).json({ success: false, error: 'Token and secret are required' });
    }
    
    console.log('verify-2fa - Verifying token:', token);
    console.log('verify-2fa - Using secret:', secret);
    
    // Vérifier le token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token
    });
    
    console.log('verify-2fa - Verification result:', verified);
    
    if (verified) {
      res.json({ success: true, message: '2FA token verified successfully' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid 2FA token' });
    }
  } catch (error) {
    console.error('verify-2fa - Error:', error);
    res.status(500).json({ success: false, error: 'Error verifying 2FA token' });
  }
});

// Démarrer le serveur
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test generate-2fa: http://localhost:${PORT}/api/auth/generate-2fa`);
  console.log(`Test verify-2fa: http://localhost:${PORT}/api/auth/verify-2fa`);
});
