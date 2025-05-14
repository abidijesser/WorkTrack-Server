const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
  content: {
    type: String,
    required: true,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: "Task",
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: "Project",
  },
  documentId: {
    type: Schema.Types.ObjectId,
    ref: "Document",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Comment", CommentSchema);
