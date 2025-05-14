const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TaskSchema = new Schema({
  title: {
    type: String,
    // All fields are now optional
  },
  description: {
    type: String,
    // All fields are now optional
  },
  status: {
    type: String,
    enum: ["To Do", "In Progress", "Done"],
    default: "To Do",
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
  dueDate: {
    type: Date,
    // All fields are now optional
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: "User",
    // All fields are now optional
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: "Project",
    // All fields are now optional
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    // All fields are now optional
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  comments: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
  googleCalendarEventId: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Task", TaskSchema);
