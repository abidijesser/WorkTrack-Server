const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ["user", "bot", "meeting"], default: "user" },
    sender: { type: String }, // User ID of the sender
    senderName: { type: String }, // Display name of the sender
    room: { type: String }, // Room identifier (e.g., meeting-123)
    id: { type: String }, // Optional unique ID for the message
  },
  {
    collection: "messages", // Collection name in the database
    timestamps: true, // Add createdAt and updatedAt fields
  }
);

module.exports = mongoose.model("Message", messageSchema);
