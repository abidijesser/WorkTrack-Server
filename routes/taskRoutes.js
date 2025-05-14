const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const auth = require("../middleware/auth");

// Routes protégées par authentification
router.use(auth);

// CRUD routes
router.post("/", taskController.createTask);
router.get("/", taskController.getAllTasks);
router.get("/:id", taskController.getTaskById);
router.put("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

// Routes pour mettre à jour uniquement le statut d'une tâche (accepte PUT et POST)
router.put("/:id/status", taskController.updateTaskStatus);
router.post("/:id/status", taskController.updateTaskStatus);

module.exports = router;
