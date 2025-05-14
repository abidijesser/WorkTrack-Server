const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const ActivityLog = require("../models/ActivityLog");

// GET all projects
const getAllProjects = async (_req, res) => {
  try {
    // Find all projects (no filtering by user)
    const projects = await Project.find()
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "tasks",
        model: "Task",
        select: "title description status priority dueDate assignedTo",
      })
      .populate("members");

    console.log(`Found ${projects.length} projects in total`);

    // For each project, find all tasks that reference this project
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];

      // If the project has no tasks or empty tasks array, find tasks that reference this project
      if (!project.tasks || project.tasks.length === 0) {
        console.log(
          `Project ${project.projectName} has no tasks in its tasks array. Finding tasks that reference this project...`
        );

        const tasksForProject = await Task.find({
          project: project._id,
        }).select("title description status priority dueDate assignedTo");

        console.log(
          `Found ${tasksForProject.length} tasks for project ${project.projectName}`
        );

        // Update the project's tasks array with these tasks
        if (tasksForProject.length > 0) {
          await Project.findByIdAndUpdate(project._id, {
            $set: { tasks: tasksForProject.map((task) => task._id) },
          });

          // Update the project in our results
          project.tasks = tasksForProject;
          console.log(
            `Updated project ${project.projectName} with ${tasksForProject.length} tasks`
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
};

// GET a single project by ID
const getProjectById = async (req, res) => {
  try {
    // Find project by ID without user restrictions
    const project = await Project.findById(req.params.id)
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "tasks",
        model: "Task",
        select: "title description status priority dueDate assignedTo",
      })
      .populate("members");

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // If the project has no tasks or empty tasks array, find tasks that reference this project
    if (!project.tasks || project.tasks.length === 0) {
      console.log(
        `Project ${project.projectName} has no tasks in its tasks array. Finding tasks that reference this project...`
      );

      const tasksForProject = await Task.find({ project: project._id }).select(
        "title description status priority dueDate assignedTo"
      );

      console.log(
        `Found ${tasksForProject.length} tasks for project ${project.projectName}`
      );

      // Update the project's tasks array with these tasks
      if (tasksForProject.length > 0) {
        await Project.findByIdAndUpdate(project._id, {
          $set: { tasks: tasksForProject.map((task) => task._id) },
        });

        // Update the project in our results
        project.tasks = tasksForProject;
        console.log(
          `Updated project ${project.projectName} with ${tasksForProject.length} tasks`
        );
      }
    }

    res.status(200).json({ success: true, project: project });
  } catch (error) {
    console.error("Erreur lors de la récupération du projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur interne lors de la récupération du projet",
    });
  }
};

// POST create a new project
const createProject = async (req, res) => {
  try {
    console.log("Données reçues :", req.body);
    const { projectName, description, startDate, endDate } = req.body;

    // Validation des champs requis
    if (!projectName || !description || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Tous les champs obligatoires doivent être remplis",
        details: {
          projectName: !projectName ? "Le nom du projet est requis" : null,
          description: !description ? "La description est requise" : null,
          startDate: !startDate ? "La date de début est requise" : null,
          endDate: !endDate ? "La date de fin est requise" : null,
        },
      });
    }

    // Validation du nombre minimum de membres (5)
    // if (
    //   !req.body.members ||
    //   !Array.isArray(req.body.members) ||
    //   req.body.members.length < 5
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     error: "Le projet doit avoir au moins 5 membres",
    //   });
    // }

    // Validation des dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({
        success: false,
        error: "La date de début doit être antérieure à la date de fin",
      });
    }

    // Création du projet avec l'owner
    const project = new Project({
      ...req.body,
      owner: req.user.id,
      status: req.body.status || "Active", // Utiliser le statut fourni ou "Active" par défaut
      // S'assurer que tasks et members sont des tableaux
      tasks: req.body.tasks || [],
      members: req.body.members || [],
    });

    await project.save();

    // Create activity log for project creation
    const activityLog = new ActivityLog({
      user: req.user.id,
      action: "CREATE",
      entityType: "PROJECT",
      entityId: project._id,
      project: project._id,
      details: {
        projectName: project.projectName,
        description: project.description
          ? project.description.substring(0, 100)
          : "",
      },
    });
    await activityLog.save();
    console.log("Activity log created for project creation");

    res.status(201).json({
      success: true,
      message: "Projet créé avec succès",
      project,
    });
  } catch (error) {
    console.error("Erreur lors de la création du projet :", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Erreur de validation",
        details: Object.values(error.errors).map((err) => err.message),
      });
    }
    res.status(500).json({
      success: false,
      error: "Erreur lors de la création du projet",
      details: error.message,
    });
  }
};

// POST add comment to project
const addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Projet non trouvé" });
    }
    if (!project.comments) {
      project.comments = [];
    }
    project.comments.push(comment);
    await project.save();
    res.status(200).json({ message: "Commentaire ajouté avec succès" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'ajout du commentaire" });
  }
};

// PUT update an existing project
const updateProject = async (req, res) => {
  try {
    // First, check if the project exists and if the current user is the owner
    const existingProject = await Project.findById(req.params.id);

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Check if the current user is the owner of the project
    if (existingProject.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error:
          "Vous n'êtes pas autorisé à modifier ce projet. Seul le propriétaire peut le modifier.",
      });
    }

    const { projectName, description, startDate, endDate, status, members } =
      req.body;
    if (!projectName || !description || !startDate || !endDate || !status) {
      return res.status(400).json({
        success: false,
        error: "Tous les champs obligatoires doivent être remplis",
      });
    }

    // Validation du nombre minimum de membres (5)
    // if (!members || !Array.isArray(members) || members.length < 5) {
    //   return res.status(400).json({
    //     success: false,
    //     error: "Le projet doit avoir au moins 5 membres",
    //   });
    // }

    // Update the project
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    // Create activity log for project update
    const activityLog = new ActivityLog({
      user: req.user.id,
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: updatedProject._id,
      project: updatedProject._id,
      details: {
        projectName: updatedProject.projectName,
        description: updatedProject.description
          ? updatedProject.description.substring(0, 100)
          : "",
        changes: Object.keys(req.body).join(", "),
      },
    });
    await activityLog.save();
    console.log("Activity log created for project update");

    res.status(200).json({
      success: true,
      project: updatedProject,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour du projet",
    });
  }
};

// DELETE a project
const deleteProject = async (req, res) => {
  try {
    // First, check if the project exists
    const existingProject = await Project.findById(req.params.id);

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Check if the current user is the owner of the project
    if (existingProject.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error:
          "Vous n'êtes pas autorisé à supprimer ce projet. Seul le propriétaire peut le supprimer.",
      });
    }

    // Create activity log for project deletion before deleting the project
    const activityLog = new ActivityLog({
      user: req.user.id,
      action: "DELETE",
      entityType: "PROJECT",
      entityId: existingProject._id,
      details: {
        projectName: existingProject.projectName,
        description: existingProject.description
          ? existingProject.description.substring(0, 100)
          : "",
      },
    });
    await activityLog.save();
    console.log("Activity log created for project deletion");

    // Delete the project
    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Projet supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du projet:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression du projet",
    });
  }
};
// GET project members
const getProjectMembers = async (req, res) => {
  try {
    const projectId = req.params.id;

    // Validate project ID
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "ID de projet requis",
      });
    }

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    // Get members details
    const members = await User.find(
      { _id: { $in: project.members } },
      "_id name email role"
    );

    res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des membres du projet:",
      error
    );
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des membres du projet",
    });
  }
};

// GET projects for the connected user (where user is a member or owner)
const getUserProjects = async (req, res) => {
  try {
    // Find projects where the user is a member or owner
    const projects = await Project.find({
      $or: [{ owner: req.user.id }, { members: req.user.id }],
    })
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "tasks",
        model: "Task",
        select: "title description status priority dueDate assignedTo",
      })
      .populate("members");

    console.log(`Found ${projects.length} projects for user ${req.user.id}`);

    // For each project, find all tasks that reference this project
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];

      // If the project has no tasks or empty tasks array, find tasks that reference this project
      if (!project.tasks || project.tasks.length === 0) {
        console.log(
          `Project ${project.projectName} has no tasks in its tasks array. Finding tasks that reference this project...`
        );

        const tasksForProject = await Task.find({
          project: project._id,
        }).select("title description status priority dueDate assignedTo");

        console.log(
          `Found ${tasksForProject.length} tasks for project ${project.projectName}`
        );

        // Update the project's tasks array with these tasks
        if (tasksForProject.length > 0) {
          await Project.findByIdAndUpdate(project._id, {
            $set: { tasks: tasksForProject.map((task) => task._id) },
          });

          // Update the project in our results
          project.tasks = tasksForProject;
          console.log(
            `Updated project ${project.projectName} with ${tasksForProject.length} tasks`
          );
        }
      }
    }

    res.status(200).json({ success: true, projects });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des projets de l'utilisateur:",
      error
    );
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des projets de l'utilisateur",
    });
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  addComment,
  updateProject,
  deleteProject,
  getProjectMembers,
  getUserProjects,
};
