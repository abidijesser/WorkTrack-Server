const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ActivityLogSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      "CREATE",
      "UPDATE",
      "DELETE",
      "COMMENT",
      "STATUS_CHANGE",
      "ASSIGN",
      "COMPLETE",
    ],
  },
  entityType: {
    type: String,
    required: true,
    enum: ["PROJECT", "TASK", "COMMENT", "USER", "DOCUMENT"],
  },
  entityId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  details: {
    type: Object,
    default: {},
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: "Project",
  },
  task: {
    type: Schema.Types.ObjectId,
    ref: "Task",
  },
  document: {
    type: Schema.Types.ObjectId,
    ref: "Document",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
ActivityLogSchema.index({ entityType: 1, entityId: 1 });
ActivityLogSchema.index({ user: 1 });
ActivityLogSchema.index({ project: 1 });
ActivityLogSchema.index({ task: 1 });
ActivityLogSchema.index({ document: 1 });
ActivityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
