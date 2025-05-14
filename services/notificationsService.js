const nodemailer = require('nodemailer')
const Notification = require('../models/Notification') // Assurez-vous que le modèle Notification existe

// Configuration du transporteur d'email
const transporter = nodemailer.createTransport({
  service: 'gmail', // Utilisez votre service d'email
  auth: {
    user: process.env.EMAIL_USER, // Adresse email
    pass: process.env.EMAIL_PASS, // Mot de passe ou App Password
  },
})

// Envoyer une notification push
const sendPushNotification = async (userId, message) => {
  try {
    // Implémentez ici l'envoi de notifications push (Firebase, OneSignal, etc.)
    console.log(`Notification push envoyée à l'utilisateur ${userId}: ${message}`)

    // Stocker l'historique
    await saveNotification(userId, message, 'push')
  } catch (err) {
    console.error('Erreur lors de l\'envoi de la notification push:', err)
  }
}

// Envoyer un email
const sendEmailNotification = async (email, subject, message) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: message,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Email envoyé à ${email}: ${subject}`)

    // Stocker l'historique
    await saveNotification(email, message, 'email')
  } catch (err) {
    console.error('Erreur lors de l\'envoi de l\'email:', err)
  }
}

// Stocker une notification dans l'historique
const saveNotification = async (recipient, message, type) => {
  try {
    const notification = new Notification({
      recipient,
      message,
      type,
      timestamp: new Date(),
    })
    await notification.save()
    console.log('Notification enregistrée dans l\'historique.')
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement de la notification:', err)
  }
}

module.exports = {
  sendPushNotification,
  sendEmailNotification,
}
