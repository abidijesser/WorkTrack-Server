const Meeting = require("../models/Meeting");
const meetingService = require("../services/meetingService");

// Get all meetings
exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate("organizer", "name email")
      .populate("participants", "name email")
      .populate("project", "projectName");

    res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ success: false, error: "Error fetching meetings" });
  }
};

// Get meeting by ID
exports.getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("organizer", "name email")
      .populate("participants", "name email")
      .populate("project", "projectName");

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }

    res.status(200).json({ success: true, meeting });
  } catch (error) {
    console.error("Error fetching meeting:", error);
    res.status(500).json({ success: false, error: "Error fetching meeting" });
  }
};

// Create a new meeting
exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      location,
      participants,
      project,
    } = req.body;

    const meeting = new Meeting({
      title,
      description,
      startTime,
      endTime,
      location,
      organizer: req.user.id,
      participants,
      project,
    });

    await meeting.save();

    res.status(201).json({ success: true, meeting });
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ success: false, error: "Error creating meeting" });
  }
};

// Update a meeting
exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }

    // Check if user is the organizer
    if (meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this meeting",
      });
    }

    const updatedMeeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, meeting: updatedMeeting });
  } catch (error) {
    console.error("Error updating meeting:", error);
    res.status(500).json({ success: false, error: "Error updating meeting" });
  }
};

// Delete a meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }

    // Check if user is the organizer
    if (meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this meeting",
      });
    }

    await Meeting.findByIdAndDelete(req.params.id);

    res
      .status(200)
      .json({ success: true, message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    res.status(500).json({ success: false, error: "Error deleting meeting" });
  }
};

// Manually start a meeting
exports.startMeeting = async (req, res) => {
  try {
    const result = await meetingService.activateMeeting(req.params.id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, meeting: result.meeting });
  } catch (error) {
    console.error("Error starting meeting:", error);
    res.status(500).json({ success: false, error: "Error starting meeting" });
  }
};

// End a meeting
exports.endMeeting = async (req, res) => {
  try {
    const result = await meetingService.endMeeting(req.params.id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res
      .status(200)
      .json({ success: true, message: "Meeting ended successfully" });
  } catch (error) {
    console.error("Error ending meeting:", error);
    res.status(500).json({ success: false, error: "Error ending meeting" });
  }
};

// Get active meetings
exports.getActiveMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ isActive: true })
      .populate("organizer", "name email")
      .populate("participants", "name email")
      .populate("project", "projectName");

    res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error("Error fetching active meetings:", error);
    res
      .status(500)
      .json({ success: false, error: "Error fetching active meetings" });
  }
};

// Join a meeting
exports.joinMeeting = async (req, res) => {
  try {
    const { meetingCode } = req.body;
    const userId = req.user.id;

    const meeting = await Meeting.findOne({
      meetingCode,
      isActive: true,
    })
      .populate("organizer", "name email")
      .populate("participants", "name email");

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: "Active meeting not found with this code",
      });
    }

    // Check if user is authorized to join this meeting
    const isOrganizer = meeting.organizer._id.toString() === userId;
    const isParticipant = meeting.participants.some(
      (participant) => participant._id.toString() === userId
    );

    if (!isOrganizer && !isParticipant) {
      return res.status(403).json({
        success: false,
        error:
          "You are not authorized to join this meeting. Only the organizer and invited participants can join.",
      });
    }

    res.status(200).json({
      success: true,
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        organizer: meeting.organizer,
        meetingUrl: meeting.meetingUrl,
      },
    });
  } catch (error) {
    console.error("Error joining meeting:", error);
    res.status(500).json({ success: false, error: "Error joining meeting" });
  }
};
