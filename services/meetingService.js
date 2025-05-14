const Meeting = require("../models/Meeting");
const crypto = require("crypto");

// Generate a unique meeting code
const generateMeetingCode = () => {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
};

// Generate a meeting URL
const generateMeetingUrl = (meetingId, meetingCode) => {
  return `/meeting-room/${meetingId}?code=${meetingCode}`;
};

// Activate a meeting
const activateMeeting = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return { success: false, error: "Meeting not found" };
    }

    const meetingCode = generateMeetingCode();
    const meetingUrl = generateMeetingUrl(meetingId, meetingCode);

    meeting.meetingCode = meetingCode;
    meeting.meetingUrl = meetingUrl;
    meeting.isActive = true;
    meeting.status = "in-progress";

    await meeting.save();

    return {
      success: true,
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        meetingCode,
        meetingUrl,
      },
    };
  } catch (error) {
    console.error("Error activating meeting:", error);
    return { success: false, error: "Failed to activate meeting" };
  }
};

// End a meeting
const endMeeting = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return { success: false, error: "Meeting not found" };
    }

    meeting.isActive = false;
    meeting.status = "completed";

    await meeting.save();

    return { success: true };
  } catch (error) {
    console.error("Error ending meeting:", error);
    return { success: false, error: "Failed to end meeting" };
  }
};

// Check for meetings that should be activated
const checkScheduledMeetings = async () => {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

    // Find meetings that should start within the next 5 minutes
    const upcomingMeetings = await Meeting.find({
      startTime: { $gte: now, $lte: fiveMinutesFromNow },
      status: "scheduled",
      isActive: false,
    });

    const activatedMeetings = [];

    for (const meeting of upcomingMeetings) {
      const result = await activateMeeting(meeting._id);
      if (result.success) {
        activatedMeetings.push(result.meeting);
      }
    }

    return activatedMeetings;
  } catch (error) {
    console.error("Error checking scheduled meetings:", error);
    return [];
  }
};

module.exports = {
  activateMeeting,
  endMeeting,
  checkScheduledMeetings,
  generateMeetingCode,
};
