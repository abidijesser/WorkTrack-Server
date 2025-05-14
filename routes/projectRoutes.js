const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const projectController = require("../controllers/projectController");
const Project = require("../models/Project");
const Task = require("../models/Task");

// GET all projects
router.get("/", auth, async (req, res) => {
  try {
    console.log("GET /api/projects - Query params:", req.query);

    // Récupérer tous les projets sans filtrer par propriétaire
    let projects = await Project.find()
      .populate({
        path: "tasks",
        model: "Task",
        select: "title description status priority dueDate assignedTo",
        // Ajouter plus d'informations sur les tâches si demandé
        ...(req.query.includeTasks && {
          options: { sort: { dueDate: 1 } },
        }),
      })
      .populate("members")
      .populate("owner");

    // Pour chaque projet, s'assurer que les tâches sont correctement récupérées
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];

      // Vérifier si les tâches sont correctement chargées
      if (!project.tasks || project.tasks.length === 0) {
        console.log(
          `Project ${project.projectName} has no tasks in its tasks array. Finding tasks that reference this project...`
        );

        // Rechercher toutes les tâches qui référencent ce projet
        const tasksForProject = await Task.find({
          project: project._id,
        }).select("title description status priority dueDate assignedTo");

        console.log(
          `Found ${tasksForProject.length} tasks for project ${project.projectName}`
        );

        // Mettre à jour le tableau de tâches du projet
        if (tasksForProject.length > 0) {
          await Project.findByIdAndUpdate(project._id, {
            $set: { tasks: tasksForProject.map((task) => task._id) },
          });

          // Mettre à jour le projet dans nos résultats
          project.tasks = tasksForProject;
          console.log(
            `Updated project ${project.projectName} with ${tasksForProject.length} tasks`
          );
        }
      } else {
        // Si le projet a déjà des tâches, s'assurer qu'elles sont complètes
        console.log(
          `Project ${project.projectName} already has ${project.tasks.length} tasks`
        );

        // Vérifier si les tâches ont toutes les informations nécessaires
        const hasIncompleteTaskInfo = project.tasks.some(
          (task) => !task || !task.status || typeof task.status !== "string"
        );

        if (hasIncompleteTaskInfo) {
          console.log(
            `Project ${project.projectName} has incomplete task information. Reloading tasks...`
          );

          // Recharger les tâches complètes
          const fullTasks = await Task.find({
            _id: { $in: project.tasks.map((t) => t._id || t) },
          }).select("title description status priority dueDate assignedTo");

          project.tasks = fullTasks;
          console.log(
            `Reloaded ${fullTasks.length} complete tasks for project ${project.projectName}`
          );
        }
      }
    }

    res.status(200).json({ success: true, projects });
  } catch (error) {
    console.error("Erreur lors de la récupération des projets:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des projets",
    });
  }
});

// GET projects for the connected user (where user is a member or owner)
router.get("/user-projects", auth, projectController.getUserProjects);

// GET a single project by ID
router.get("/:id", auth, projectController.getProjectById);

// POST create a new project
router.post("/", auth, projectController.createProject);

// POST add comment to project
router.post("/:id/comments", auth, projectController.addComment);

// PUT update an existing project
router.put("/:id", auth, projectController.updateProject);

// DELETE a project
router.delete("/:id", auth, projectController.deleteProject);

// GET project members
router.get("/:id/members", projectController.getProjectMembers);

module.exports = router;
