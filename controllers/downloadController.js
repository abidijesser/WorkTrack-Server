const ShareLink = require('../models/ShareLink');
const path = require('path');
const fs = require('fs');

// Télécharger un document partagé
const downloadSharedDocument = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Récupérer les informations de la requête pour la journalisation
    const requestInfo = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown'
    };
    
    // Trouver le lien de partage
    const shareLink = await ShareLink.findOne({ token }).populate('document');
    
    if (!shareLink || !shareLink.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Lien de partage invalide ou expiré'
      });
    }
    
    // Vérifier si le lien a expiré
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      shareLink.isActive = false;
      await shareLink.save();
      
      return res.status(401).json({
        success: false,
        error: 'Ce lien de partage a expiré'
      });
    }
    
    // Vérifier si le document existe
    if (!shareLink.document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }
    
    const filePath = shareLink.document.filePath;
    const fileName = shareLink.document.name;
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Fichier non trouvé'
      });
    }
    
    // Enregistrer le téléchargement dans le journal d'accès
    const logEntry = {
      timestamp: new Date(),
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
      action: 'download',
      success: true
    };
    
    shareLink.accessLog.push(logEntry);
    await shareLink.save();
    
    // Envoyer le fichier
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Erreur lors du téléchargement du document:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du téléchargement du document'
    });
  }
};

module.exports = {
  downloadSharedDocument
};
