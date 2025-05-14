const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShareLinkSchema = new Schema({
  document: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  accessLevel: {
    type: String,
    enum: ['view', 'edit', 'comment'],
    default: 'view'
  },
  password: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  emailsSent: {
    type: Number,
    default: 0
  },
  securityMetadata: {
    originalFileType: String,
    originalFileSize: Number,
    originalFileName: String,
    originalChecksum: String,
    createdAt: Date,
    userAgent: String,
    ipAddress: String
  },
  accessLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    action: {
      type: String,
      enum: ['view', 'download', 'password_attempt', 'password_success', 'password_fail']
    },
    success: Boolean
  }]
});

// Index pour des recherches plus rapides
ShareLinkSchema.index({ token: 1 });
ShareLinkSchema.index({ document: 1 });
ShareLinkSchema.index({ createdBy: 1 });
ShareLinkSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('ShareLink', ShareLinkSchema);
