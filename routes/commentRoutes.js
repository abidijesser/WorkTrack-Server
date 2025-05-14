const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const commentController = require("../controllers/commentController");

// Apply auth middleware to all routes
router.use(auth);

// Task comments
router.post("/task/:taskId", commentController.createTaskComment);
router.get("/task/:taskId", commentController.getTaskComments);

// Project comments
router.post("/project/:projectId", commentController.createProjectComment);
router.get("/project/:projectId", commentController.getProjectComments);

// Document comments
router.post("/document/:documentId", commentController.createDocumentComment);
router.get("/document/:documentId", commentController.getDocumentComments);

// Comment operations
router.put("/:commentId", commentController.updateComment);
router.delete("/:commentId", commentController.deleteComment);

module.exports = router;
