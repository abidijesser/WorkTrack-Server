const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const crypto = require("crypto");

const DocumentSchema = new Schema({
  uniqueId: {
    type: String,
    default: () => crypto.randomUUID(),
    index: true, // Pour des recherches plus rapides
  },
  displayId: {
    type: String,
    default: function() {
      // Générer un ID court et lisible (ex: DOC-XXXX-XXXX)
      const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
      return `DOC-${randomPart}`;
    }
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: "Project",
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  uploadedDate: {
    type: Date,
    default: Date.now,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  permissions: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      access: {
        type: String,
        enum: ["view", "edit", "admin"],
        default: "view",
      },
    },
  ],
  versions: [
    {
      uniqueId: {
        type: String,
        default: () => crypto.randomUUID(),
      },
      filePath: String,
      fileSize: Number,
      fileType: String,
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      uploadedDate: {
        type: Date,
        default: Date.now,
      },
      comment: String,
    },
  ],
  comments: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
});

module.exports = mongoose.model("Document", DocumentSchema);
