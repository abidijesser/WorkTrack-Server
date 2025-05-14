const Notification = require("../models/Notification");
const User = require("../models/User");
let io;

// Fonction pour initialiser Socket.io
const initializeSocketIO = (socketIo) => {
  io = socketIo;
  console.log("Socket.io initialisé dans notificationService");
};

// Fonction helper pour générer les messages de notification de tâches
function getTaskNotificationMessage(task, type, creator) {
  // Vérifier si task est valide
  if (!task || !task.title) {
    return "Nouvelle notification concernant une tâche";
  }

  // Vérifier si creator est valide
  const creatorName = creator && creator.name ? creator.name : "Un utilisateur";

  // Générer le message en fonction du type
  switch (type) {
    case "task_created":
      return `${creatorName} a créé une nouvelle tâche: ${task.title}`;
    case "task_updated":
      return `${creatorName} a mis à jour la tâche: ${task.title}`;
    case "task_assigned":
      return `${creatorName} vous a assigné la tâche: ${task.title}`;
    case "task_completed":
      return `${creatorName} a marqué la tâche comme terminée: ${task.title}`;
    case "task_status_updated":
      return `${creatorName} a mis à jour le statut de la tâche: ${task.title}`;
    default:
      return `Nouvelle notification concernant la tâche: ${task.title}`;
  }
}

// Fonction utilitaire pour générer le message de notification pour un document
function getDocumentNotificationMessage(document, type, creator) {
  // Vérifier si creator est valide
  const creatorName = creator && creator.name ? creator.name : "Un utilisateur";

  // Générer le message en fonction du type
  switch (type) {
    case "document_uploaded":
      return `${creatorName} a ajouté un nouveau document: ${document.name}`;
    case "document_updated":
      return `${creatorName} a mis à jour le document: ${document.name}`;
    case "document_version_added":
      return `${creatorName} a ajouté une nouvelle version du document: ${document.name}`;
    case "document_commented":
      return `${creatorName} a commenté le document: ${document.name}`;
    case "document_shared":
      return `${creatorName} a partagé le document: ${document.name} avec vous`;
    default:
      return `Nouvelle notification concernant le document: ${document.name}`;
  }
}

const notificationService = {
  // Créer une notification
  async createNotification(data) {
    try {
      console.log("Création d'une notification:", data);
      const notification = new Notification(data);
      await notification.save();
      console.log("Notification créée avec succès:", notification._id);
      
      // Émettre la notification via socket.io si disponible
      if (io) {
        // Émettre à l'utilisateur spécifique
        io.to(`user-${data.recipient}`).emit('notification', notification);
        
        // Si la notification est liée à un projet, émettre également au projet
        if (data.project) {
          io.to(`project-${data.project}`).emit('projectNotification', notification);
        }
      }
      
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  },

  // Créer une notification de tâche (version robuste)
  async createTaskNotification(task, type, creator) {
    try {
      console.log(
        `Création d'une notification de tâche: ${type} pour la tâche ${task._id}`
      );

      // Vérifier si les paramètres requis sont présents
      if (!task || !task._id) {
        console.error("createTaskNotification - Task is missing or invalid");
        return; // Ne pas bloquer le processus, simplement retourner
      }

      // Gérer le cas où creator est null ou undefined
      const creatorName =
        creator && creator.name ? creator.name : "Un utilisateur";

      try {
        // Récupérer tous les utilisateurs qui doivent être notifiés
        const users = await User.find({});
        console.log(`Nombre d'utilisateurs trouvés: ${users.length}`);

        if (!users || users.length === 0) {
          console.log("Aucun utilisateur trouvé, aucune notification à créer");
          return;
        }

        const notifications = users.map((user) => ({
          recipient: user._id,
          type,
          task: task._id,
          message: getTaskNotificationMessage(task, type, {
            name: creatorName,
          }),
        }));

        console.log(`Création de ${notifications.length} notifications`);
        await Notification.insertMany(notifications);
        console.log("Notifications de tâche créées avec succès");
      } catch (innerError) {
        console.error("Error in notification creation process:", innerError);
        // Ne pas propager l'erreur pour ne pas bloquer le processus principal
      }
    } catch (error) {
      console.error("Error creating task notification:", error);
      // Ne pas propager l'erreur pour ne pas bloquer le processus principal
    }
  },

  // Marquer une notification comme lue
  async markAsRead(notificationId) {
    try {
      console.log(`Marquage de la notification ${notificationId} comme lue`);
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
      );
      console.log(
        "Notification mise à jour:",
        notification ? "succès" : "non trouvée"
      );
      return notification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  // Obtenir les notifications d'un utilisateur
  async getUserNotifications(userId) {
    try {
      console.log(
        `Récupération des notifications pour l'utilisateur ${userId}`
      );

      // Vérifier si l'utilisateur existe
      const user = await User.findById(userId);
      if (!user) {
        console.error(`Utilisateur ${userId} non trouvé`);
        throw new Error(`Utilisateur ${userId} non trouvé`);
      }

      const notifications = await Notification.find({ recipient: userId })
        .populate("task")
        .populate("document")
        .populate("project")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

      console.log(
        `Nombre de notifications trouvées pour l'utilisateur ${userId}: ${notifications.length}`
      );
      return notifications;
    } catch (error) {
      console.error("Error getting user notifications:", error);
      throw error;
    }
  },

  // Créer une notification pour un document
  async createDocumentNotification(document, type, creator) {
    try {
      console.log(
        `Création d'une notification de document: ${type} pour le document ${document._id}`
      );

      // Vérifier si les paramètres requis sont présents
      if (!document || !document._id) {
        console.error("createDocumentNotification - Document is missing or invalid");
        return;
      }

      // Gérer le cas où creator est null ou undefined
      const creatorName =
        creator && creator.name ? creator.name : "Un utilisateur";
      const creatorId = creator && creator.id ? creator.id : null;

      try {
        // Déterminer les destinataires de la notification
        let recipients = [];

        // Si le document est associé à un projet, notifier tous les membres du projet
        if (document.project) {
          const Project = require("../models/Project");
          const project = await Project.findById(document.project);
          
          if (project && project.members && project.members.length > 0) {
            recipients = [...project.members];
            
            // Ajouter le propriétaire du projet s'il n'est pas déjà dans les membres
            if (project.owner && !recipients.includes(project.owner.toString())) {
              recipients.push(project.owner);
            }
          }
        }

        // Ajouter les utilisateurs qui ont des permissions explicites sur le document
        if (document.permissions && document.permissions.length > 0) {
          document.permissions.forEach(permission => {
            if (permission.user && !recipients.includes(permission.user.toString())) {
              recipients.push(permission.user);
            }
          });
        }

        // Si le document est public, notifier tous les utilisateurs
        // (dans un système réel, on limiterait cela)
        if (document.isPublic) {
          const users = await User.find({});
          users.forEach(user => {
            if (!recipients.includes(user._id.toString())) {
              recipients.push(user._id);
            }
          });
        }

        // Filtrer le créateur de la notification pour éviter qu'il ne reçoive sa propre notification
        if (creatorId) {
          recipients = recipients.filter(id => id.toString() !== creatorId.toString());
        }

        console.log(`Nombre de destinataires pour la notification: ${recipients.length}`);

        // Créer une notification pour chaque destinataire
        const notifications = [];
        for (const recipientId of recipients) {
          const notificationData = {
            recipient: recipientId,
            type,
            document: document._id,
            project: document.project || null,
            message: getDocumentNotificationMessage(document, type, {
              name: creatorName,
            }),
            createdBy: creatorId,
          };

          const notification = await this.createNotification(notificationData);
          notifications.push(notification);
        }

        console.log(`${notifications.length} notifications de document créées avec succès`);
        return notifications;
      } catch (innerError) {
        console.error("Error in document notification creation process:", innerError);
        // Ne pas propager l'erreur pour ne pas bloquer le processus principal
      }
    } catch (error) {
      console.error("Error creating document notification:", error);
      // Ne pas propager l'erreur pour ne pas bloquer le processus principal
    }
  },

  // Créer une notification pour un commentaire sur un document
  async createDocumentCommentNotification(document, comment, creator) {
    try {
      console.log(
        `Création d'une notification de commentaire pour le document ${document._id}`
      );

      // Vérifier si les paramètres requis sont présents
      if (!document || !document._id || !comment) {
        console.error("createDocumentCommentNotification - Document or comment is missing or invalid");
        return;
      }

      // Appeler la fonction générique avec le type spécifique
      return await this.createDocumentNotification(document, "document_commented", creator);
    } catch (error) {
      console.error("Error creating document comment notification:", error);
    }
  },

  // Créer une notification pour une nouvelle version de document
  async createDocumentVersionNotification(document, creator) {
    try {
      console.log(
        `Création d'une notification de nouvelle version pour le document ${document._id}`
      );

      // Vérifier si les paramètres requis sont présents
      if (!document || !document._id) {
        console.error("createDocumentVersionNotification - Document is missing or invalid");
        return;
      }

      // Appeler la fonction générique avec le type spécifique
      return await this.createDocumentNotification(document, "document_version_added", creator);
    } catch (error) {
      console.error("Error creating document version notification:", error);
    }
  }
};

module.exports = { ...notificationService, initializeSocketIO };
