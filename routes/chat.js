const express = require('express')
const router = express.Router()
const Message = require('../models/Message') // Assurez-vous que le modèle Message existe

// Récupérer tous les messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find()
    res.json(messages)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' })
  }
})

// Ajouter un nouveau message
router.post('/', async (req, res) => {
  const { content, timestamp } = req.body
  try {
    const newMessage = new Message({ content, timestamp })
    await newMessage.save()
    res.status(201).json(newMessage)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du message' })
  }
})

module.exports = router
