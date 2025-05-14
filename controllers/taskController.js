const Task = require("../models/Task");
const Project = require("../models/Project");
const ActivityLog = require("../models/ActivityLog");
const mongoose = require("mongoose");
const notificationService = require("../services/notificationService");

// Fonction utilitaire pour valider un ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Créer une tâche
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      project,
    } = req.body;

    // All fields are now optional, no validation needed
    console.log("All fields are optional, proceeding with task creation");

    // Only validate IDs if they are provided
    if (assignedTo && !isValidObjectId(assignedTo)) {
      return res.status(400).json({
        success: false,
        error: "ID d'assignation invalide",
      });
    }

    if (project && !isValidObjectId(project)) {
      return res.status(400).json({
        success: false,
        error: "ID de projet invalide",
      });
    }

    // Vérifier si le projet existe
    if (project) {
      const projectData = await Project.findById(project);
      if (!projectData) {
        return res.status(404).json({
          success: false,
          error: "Projet non trouvé",
        });
      }

      // Vérifier si l'utilisateur connecté est le propriétaire du projet ou un administrateur
      const isAdmin = req.user.role === "Admin";
      const isProjectOwner = projectData.owner.toString() === req.user.id;

      if (!isAdmin && !isProjectOwner) {
        return res.status(403).json({
          success: false,
          error:
            "Seul le propriétaire du projet ou un administrateur peut créer des tâches pour ce projet",
        });
      }

      // Vérifier si l'utilisateur assigné est membre du projet
      if (assignedTo && !projectData.members.includes(assignedTo)) {
        return res.status(400).json({
          success: false,
          error: "L'utilisateur assigné doit être membre du projet",
        });
      }
    }

    // Créer la tâche
    const task = new Task({
      title,
      description,
      status: status || "To Do",
      priority: priority || "Medium",
      dueDate: dueDate || new Date(),
      createdBy: req.user.id,
      assignedTo: assignedTo || null,
      project: project || null,
    });

    await task.save();

    // If the task is associated with a project, add it to the project's tasks array
    if (project) {
      await Project.findByIdAndUpdate(
        project,
        { $push: { tasks: task._id } },
        { new: true }
      );
      console.log(`Added task ${task._id} to project ${project}`);
    }

    // Create activity log for task creation
    const activityLog = new ActivityLog({
      user: req.user.id,
      action: "CREATE",
      entityType: "TASK",
      entityId: task._id,
      task: task._id,
      project: project || null,
      details: {
        title: task.title,
        description: task.description ? task.description.substring(0, 100) : "",
      },
    });
    await activityLog.save();
    console.log("Activity log created for task creation");

    // Créer une notification pour la nouvelle tâche
    await notificationService.createTaskNotification(
      task,
      "task_created",
      req.user
    );

    // Peupler les références pour la réponse
    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("project", "projectName")
      .populate("createdBy", "name");

    res.status(201).json({
      success: true,
      task: populatedTask,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la création de la tâche",
      details: error.message,
    });
  }
};

// Obtenir toutes les tâches
const getAllTasks = async (req, res) => {
  try {
    // Check if project filter is provided
    const { project } = req.query;
    console.log("getAllTasks - Project filter:", project);

    // Build query based on filters
    const query = {};
    if (project) {
      query.project = project;
      console.log("getAllTasks - Filtering tasks by project:", project);
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email")
      .populate({
        path: "project",
        select: "projectName owner",
        populate: {
          path: "owner",
          select: "name email _id",
        },
      })
      .populate("createdBy", "name");

    console.log("getAllTasks - Found tasks:", tasks.length);

    res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des tâches",
    });
  }
};

// Obtenir une tâche par ID
const getTaskById = async (req, res) => {
  try {
    console.log("getTaskById - Task ID:", req.params.id);

    if (!isValidObjectId(req.params.id)) {
      console.log("getTaskById - Invalid task ID format");
      return res.status(400).json({
        success: false,
        error: "ID de tâche invalide",
      });
    }

    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email")
      .populate({
        path: "project",
        select: "projectName owner",
        populate: {
          path: "owner",
          select: "name email _id",
        },
      })
      .populate("createdBy", "name");

    console.log("getTaskById - Task found:", task ? "Yes" : "No");

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Tâche non trouvée",
      });
    }

    console.log("getTaskById - Task details:", {
      id: task._id,
      title: task.title,
      assignedTo: task.assignedTo ? task.assignedTo._id : null,
      project: task.project ? task.project._id : null,
    });

    res.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la tâche",
    });
  }
};

// Mettre à jour une tâche
const updateTask = async (req, res) => {
  try {
    console.log("updateTask - Request body:", req.body);
    console.log("updateTask - Task ID:", req.params.id);

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      project,
    } = req.body;

    // Validation de l'ID de la tâche
    if (!isValidObjectId(req.params.id)) {
      console.log("updateTask - Invalid task ID format");
      return res.status(400).json({
        success: false,
        error: "ID de tâche invalide",
      });
    }

    // All fields are now optional, no validation needed
    console.log(
      "All fields are optional for task update, proceeding with update"
    );

    // Log the update data
    console.log("updateTask - Update data after validation:", {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      project,
    });

    // Validation des IDs (seulement si présents)
    if (assignedTo && !isValidObjectId(assignedTo)) {
      console.log("updateTask - Invalid assignedTo ID:", assignedTo);
      return res.status(400).json({
        success: false,
        error: "ID d'assignation invalide",
      });
    }

    if (project && !isValidObjectId(project)) {
      console.log("updateTask - Invalid project ID:", project);
      return res.status(400).json({
        success: false,
        error: "ID de projet invalide",
      });
    }

    // Vérifier si l'utilisateur est le propriétaire du projet et si l'utilisateur assigné est membre du projet
    if (project) {
      try {
        const projectData = await Project.findById(project);
        if (!projectData) {
          console.log("updateTask - Project not found:", project);
          return res.status(404).json({
            success: false,
            error: "Projet non trouvé",
          });
        }

        // Vérifier si l'utilisateur connecté est le propriétaire du projet ou un administrateur
        const isAdmin = req.user.role === "Admin";
        const isProjectOwner = projectData.owner.toString() === req.user.id;

        if (!isAdmin && !isProjectOwner) {
          console.log("updateTask - User is not the project owner or admin");
          return res.status(403).json({
            success: false,
            error:
              "Seul le propriétaire du projet ou un administrateur peut modifier des tâches pour ce projet",
          });
        }

        // Vérifier si l'utilisateur assigné est membre du projet
        if (assignedTo && !projectData.members.includes(assignedTo)) {
          console.log("updateTask - User is not a member of the project:", {
            user: assignedTo,
            project: project,
            members: projectData.members,
          });
          return res.status(400).json({
            success: false,
            error: "L'utilisateur assigné doit être membre du projet",
          });
        }
      } catch (projectError) {
        console.error(
          "updateTask - Error checking project membership:",
          projectError
        );
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la vérification du projet",
        });
      }
    }

    // Vérifier si la tâche existe et si l'utilisateur est le propriétaire du projet associé
    const taskWithProject = await Task.findById(req.params.id).populate(
      "project"
    );
    if (!taskWithProject) {
      console.log("updateTask - Task not found before update");
      return res.status(404).json({
        success: false,
        error: "Tâche non trouvée",
      });
    }

    // Si la tâche a un projet et que l'utilisateur n'est pas le propriétaire ou un administrateur
    const isAdmin = req.user.role === "Admin";
    if (
      taskWithProject.project &&
      taskWithProject.project.owner &&
      taskWithProject.project.owner.toString() !== req.user.id &&
      !isAdmin
    ) {
      console.log(
        "updateTask - User is not the owner of the task's project or an admin"
      );
      return res.status(403).json({
        success: false,
        error:
          "Seul le propriétaire du projet ou un administrateur peut modifier cette tâche",
      });
    }

    // Préparer les données de mise à jour
    const updateData = {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo: assignedTo || null,
      project: project || null,
    };

    // Supprimer les champs undefined
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    // We already checked if the task exists with taskWithProject

    console.log("updateTask - Updating task with data:", updateData);

    // Get the original project ID before updating
    const originalProjectId = taskWithProject.project
      ? taskWithProject.project._id
      : null;
    const newProjectId = updateData.project;

    // Update the task
    const task = await Task.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "name email")
      .populate("project", "projectName")
      .populate("createdBy", "name");

    console.log("updateTask - Updated task:", task ? "Success" : "Failed");

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Tâche non trouvée",
      });
    }

    // Handle project changes
    if (newProjectId !== undefined) {
      // If project has changed
      if (
        originalProjectId &&
        newProjectId &&
        originalProjectId.toString() !== newProjectId.toString()
      ) {
        // Remove task from old project
        await Project.findByIdAndUpdate(originalProjectId, {
          $pull: { tasks: req.params.id },
        });

        // Add task to new project
        await Project.findByIdAndUpdate(newProjectId, {
          $push: { tasks: req.params.id },
        });

        console.log(
          `Moved task ${req.params.id} from project ${originalProjectId} to ${newProjectId}`
        );
      }
      // If task didn't have a project before but now has one
      else if (!originalProjectId && newProjectId) {
        await Project.findByIdAndUpdate(newProjectId, {
          $push: { tasks: req.params.id },
        });

        console.log(`Added task ${req.params.id} to project ${newProjectId}`);
      }
      // If task had a project before but now doesn't
      else if (originalProjectId && !newProjectId) {
        await Project.findByIdAndUpdate(originalProjectId, {
          $pull: { tasks: req.params.id },
        });

        console.log(
          `Removed task ${req.params.id} from project ${originalProjectId}`
        );
      }
    }

    // Create activity log for task update
    const activityLog = new ActivityLog({
      user: req.user.id,
      action: "UPDATE",
      entityType: "TASK",
      entityId: task._id,
      task: task._id,
      project: task.project || null,
      details: {
        title: task.title,
        description: task.description ? task.description.substring(0, 100) : "",
        changes: Object.keys(updateData).join(", "),
      },
    });
    await activityLog.save();
    console.log("Activity log created for task update");

    // Créer une notification pour la mise à jour de la tâche
    await notificationService.createTaskNotification(
      task,
      "task_updated",
      req.user
    );

    res.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Erreur de validation",
        details: Object.values(error.errors).map((err) => err.message),
      });
    }
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour de la tâche",
    });
  }
};

// Supprimer une tâche
const deleteTask = async (req, res) => {
  try {
    console.log("deleteTask - Task ID:", req.params.id);
    console.log(
      "deleteTask - User:",
      req.user ? { id: req.user._id, role: req.user.role } : "No user"
    );

    if (!isValidObjectId(req.params.id)) {
      console.log("deleteTask - Invalid task ID format");
      return res.status(400).json({
        success: false,
        error: "ID de tâche invalide",
      });
    }

    // Récupérer la tâche avec les informations du projet
    const task = await Task.findById(req.params.id).populate("project");

    if (!task) {
      console.log("deleteTask - Task not found");
      return res.status(404).json({
        success: false,
        error: "Tâche non trouvée",
      });
    }

    // Vérifier si l'utilisateur est administrateur ou propriétaire du projet
    const isAdmin = req.user.role === "Admin";
    const isProjectOwner =
      task.project &&
      task.project.owner &&
      task.project.owner.toString() === req.user.id;

    console.log("deleteTask - User is admin:", isAdmin);
    console.log("deleteTask - User is project owner:", isProjectOwner);

    // Autoriser la suppression uniquement pour les administrateurs ou les propriétaires du projet
    if (!isAdmin && !isProjectOwner) {
      console.log("deleteTask - User is not authorized to delete this task");
      return res.status(403).json({
        success: false,
        error:
          "Seuls les administrateurs ou le propriétaire du projet peuvent supprimer cette tâche",
      });
    }

    // If the task is associated with a project, remove it from the project's tasks array
    if (task.project) {
      await Project.findByIdAndUpdate(task.project._id, {
        $pull: { tasks: req.params.id },
      });
      console.log(
        `Removed task ${req.params.id} from project ${task.project._id}`
      );
    }

    // Create activity log for task deletion
    const activityLog = new ActivityLog({
      user: req.user.id,
      action: "DELETE",
      entityType: "TASK",
      entityId: req.params.id,
      project: task.project ? task.project._id : null,
      details: {
        title: task.title,
        description: task.description ? task.description.substring(0, 100) : "",
      },
    });
    await activityLog.save();
    console.log("Activity log created for task deletion");

    // Supprimer la tâche
    await Task.findByIdAndDelete(req.params.id);
    console.log("deleteTask - Task deleted successfully");

    res.json({
      success: true,
      message: "Tâche supprimée avec succès",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de la tâche",
    });
  }
};

// Mettre à jour uniquement le statut d'une tâche (version simplifiée et robuste)
const updateTaskStatus = async (req, res) => {
  try {
    console.log("updateTaskStatus - Request body:", req.body);
    console.log("updateTaskStatus - Task ID:", req.params.id);
    console.log(
      "updateTaskStatus - User:",
      req.user ? { id: req.user._id, email: req.user.email } : "No user"
    );

    // Validation de l'ID de la tâche
    if (!isValidObjectId(req.params.id)) {
      console.log("updateTaskStatus - Invalid task ID");
      return res.status(400).json({
        success: false,
        error: "ID de tâche invalide",
      });
    }

    // Récupérer la tâche
    let existingTask;
    try {
      existingTask = await Task.findById(req.params.id);
      console.log(
        "updateTaskStatus - Existing task found:",
        existingTask ? true : false
      );
    } catch (findError) {
      console.error("updateTaskStatus - Error finding task:", findError);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la recherche de la tâche",
      });
    }

    if (!existingTask) {
      console.log("updateTaskStatus - Task not found");
      return res.status(404).json({
        success: false,
        error: "Tâche non trouvée",
      });
    }

    // Vérifier si l'utilisateur est assigné à cette tâche ou est un administrateur
    const isAdmin = req.user.role === "Admin";
    const isAssignedUser =
      existingTask.assignedTo &&
      existingTask.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isAssignedUser) {
      console.log(
        "updateTaskStatus - User is not assigned to this task and is not an admin"
      );
      console.log("Task assignedTo:", existingTask.assignedTo);
      console.log("Current user:", req.user._id);
      console.log("Is admin:", isAdmin);
      return res.status(403).json({
        success: false,
        error:
          "Vous n'êtes pas autorisé à modifier le statut de cette tâche. Seul l'utilisateur assigné ou un administrateur peut modifier le statut.",
      });
    }

    // Extraire le statut de la requête
    let status;
    if (typeof req.body === "string") {
      try {
        const parsedBody = JSON.parse(req.body);
        status = parsedBody.status;
        console.log(
          "updateTaskStatus - Parsed status from string body:",
          status
        );
      } catch (parseError) {
        console.error(
          "updateTaskStatus - Error parsing request body:",
          parseError
        );
        status = null;
      }
    } else {
      status = req.body.status;
      console.log(
        "updateTaskStatus - Status from request body object:",
        status
      );
    }

    // Vérifier si le statut est fourni
    if (!status) {
      console.log("updateTaskStatus - Status is missing");
      return res.status(400).json({
        success: false,
        error: "Le statut est requis",
      });
    }

    // Liste des statuts valides
    const validStatuses = ["To Do", "In Progress", "Done"];
    console.log("updateTaskStatus - Valid statuses:", validStatuses);

    // Vérifier si le statut est valide
    if (!validStatuses.includes(status)) {
      console.log("updateTaskStatus - Invalid status:", status);
      return res.status(400).json({
        success: false,
        error: `Statut invalide. Les valeurs autorisées sont: ${validStatuses.join(
          ", "
        )}`,
      });
    }

    // Mettre à jour le statut
    console.log(
      "updateTaskStatus - Updating task status from",
      existingTask.status,
      "to",
      status
    );
    existingTask.status = status;

    try {
      await existingTask.save();
      console.log("updateTaskStatus - Task status updated successfully");
    } catch (saveError) {
      console.error("updateTaskStatus - Error saving task:", saveError);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'enregistrement de la tâche",
      });
    }

    // Récupérer la tâche mise à jour avec les relations
    let updatedTask;
    try {
      updatedTask = await Task.findById(req.params.id)
        .populate("assignedTo", "name email")
        .populate("project", "projectName")
        .populate("createdBy", "name");
      console.log("updateTaskStatus - Updated task retrieved successfully");
    } catch (populateError) {
      console.error(
        "updateTaskStatus - Error retrieving updated task:",
        populateError
      );
      // Continuer même si la récupération échoue, car la mise à jour a déjà réussi
      updatedTask = existingTask;
    }

    // Create activity log for status change
    try {
      const activityLog = new ActivityLog({
        user: req.user.id,
        action: "STATUS_CHANGE",
        entityType: "TASK",
        entityId: updatedTask._id,
        task: updatedTask._id,
        project: updatedTask.project || null,
        details: {
          title: updatedTask.title,
          oldStatus: existingTask.status,
          newStatus: status,
        },
      });
      await activityLog.save();
      console.log("updateTaskStatus - Activity log created for status change");
    } catch (activityError) {
      console.error(
        "updateTaskStatus - Error creating activity log:",
        activityError
      );
      // Continue even if activity log creation fails
    }

    // Créer une notification (gérer les erreurs sans interrompre le processus)
    try {
      await notificationService.createTaskNotification(
        updatedTask,
        "task_status_updated",
        req.user
      );
      console.log("updateTaskStatus - Notification created successfully");
    } catch (notificationError) {
      console.error(
        "updateTaskStatus - Error creating notification:",
        notificationError
      );
      // Continuer même si la création de notification échoue
    }

    // Renvoyer la réponse
    console.log("updateTaskStatus - Sending success response");
    res.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error("Update task status error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour du statut de la tâche",
    });
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
};
