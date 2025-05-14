// Server/config/emailConfig.js
const nodemailer = require('nodemailer');
require('dotenv').config(); // Make sure dotenv is configured

const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your email provider
  auth: {
    user: process.env.EMAIL_USERNAME, // Your email address from .env
    pass: process.env.EMAIL_PASSWORD, // Your email app password from .env
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error configuring email transporter:', error);
  } else {
    console.log('✅ Email transporter configured successfully.');
  }
});

module.exports = transporter;