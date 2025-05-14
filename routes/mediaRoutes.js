const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");
const auth = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(auth);

// Get all media (accessible to all authenticated users)
router.get("/", mediaController.getAllMedia);

// Get media by ID
router.get("/:id", mediaController.getMediaById);

// Upload new media
router.post(
  "/upload",
  mediaController.upload.single("file"),
  mediaController.uploadMedia
);

// Update media
router.put("/:id", mediaController.updateMedia);

// Delete media
router.delete("/:id", mediaController.deleteMedia);

// Get media by project
router.get("/project/:projectId", mediaController.getMediaByProject);

// Get media by task
router.get("/task/:taskId", mediaController.getMediaByTask);

// Get media by user
router.get("/user/:userId", mediaController.getMediaByUser);

module.exports = router;
