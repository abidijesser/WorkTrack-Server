const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MediaSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      enum: ["image", "document", "video", "audio", "other"],
    },
    filePath: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    tags: [String],
    uploadedDate: {
      type: Date,
      default: Date.now,
    },
    // Google Drive specific fields
    driveFileId: {
      type: String,
      default: null,
    },
    driveViewLink: {
      type: String,
      default: null,
    },
    driveDownloadLink: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Helper method to determine file type based on mime type
MediaSchema.statics.getFileTypeFromMimeType = function (mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("document") ||
    mimeType.includes("text/") ||
    mimeType.includes("application/vnd.ms-") ||
    mimeType.includes("application/vnd.openxmlformats-")
  )
    return "document";
  return "other";
};

module.exports = mongoose.model("Media", MediaSchema);
