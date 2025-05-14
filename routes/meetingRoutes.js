const express = require("express");
const router = express.Router();
const meetingController = require("../controllers/meetingController");
const auth = require("../middleware/auth");

// Apply auth middleware to all routes
router.use(auth);

// Get all meetings
router.get("/", meetingController.getAllMeetings);

// Get active meetings
router.get("/active", meetingController.getActiveMeetings);

// Get meeting by ID
router.get("/:id", meetingController.getMeetingById);

// Create a new meeting
router.post("/", meetingController.createMeeting);

// Start a meeting
router.post("/:id/start", meetingController.startMeeting);

// End a meeting
router.post("/:id/end", meetingController.endMeeting);

// Join a meeting
router.post("/join", meetingController.joinMeeting);

// Update a meeting
router.put("/:id", meetingController.updateMeeting);

// Delete a meeting
router.delete("/:id", meetingController.deleteMeeting);

module.exports = router;
