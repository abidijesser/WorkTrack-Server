const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      // Notifications de tâches
      'task_created',
      'task_updated',
      'task_assigned',
      'task_completed',
      // Notifications de documents
      'document_uploaded',
      'document_updated',
      'document_version_added',
      'document_commented',
      'document_shared'
    ],
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
})

module.exports = mongoose.model('Notification', notificationSchema)
