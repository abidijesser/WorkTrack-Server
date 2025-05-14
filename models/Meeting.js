const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
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
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      trim: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled"],
      default: "scheduled",
    },
    meetingUrl: {
      type: String,
      default: null,
    },
    meetingCode: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);
