const mongoose = require("mongoose");
const Task = require("../models/Task");
const Project = require("../models/Project");
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://medfiraschiha90:Firas123@cluster0.ixnxnxl.mongodb.net/worktrack?retryWrites=true&w=majority")
  .then(async () => {
    console.log("Connected to MongoDB");
    
    try {
      // Get all tasks
      const tasks = await Task.find();
      console.log(`Found ${tasks.length} tasks`);
      
      // Get all projects
      const projects = await Project.find();
      console.log(`Found ${projects.length} projects`);
      
      // Create a map of project IDs to task IDs
      const projectTaskMap = {};
      
      // Populate the map with tasks that have a project
      for (const task of tasks) {
        if (task.project) {
          const projectId = task.project.toString();
          if (!projectTaskMap[projectId]) {
            projectTaskMap[projectId] = [];
          }
          projectTaskMap[projectId].push(task._id);
        }
      }
      
      // Update each project with its tasks
      let updatedCount = 0;
      for (const projectId in projectTaskMap) {
        const taskIds = projectTaskMap[projectId];
        console.log(`Project ${projectId} has ${taskIds.length} tasks`);
        
        // Update the project with the task IDs
        await Project.findByIdAndUpdate(
          projectId,
          { $set: { tasks: taskIds } }
        );
        updatedCount++;
      }
      
      console.log(`Updated ${updatedCount} projects with tasks`);
      
      // Check if there are any projects without tasks
      const projectsWithoutTasks = await Project.find({ tasks: { $size: 0 } });
      console.log(`Found ${projectsWithoutTasks.length} projects without tasks`);
      
      // Create some sample tasks for projects without tasks
      for (const project of projectsWithoutTasks) {
        console.log(`Creating sample tasks for project ${project.projectName}`);
        
        // Create 3 sample tasks for each project
        const taskStatuses = ["To Do", "In Progress", "Done"];
        const taskPriorities = ["Low", "Medium", "High"];
        
        const taskIds = [];
        
        for (let i = 0; i < 3; i++) {
          const task = new Task({
            title: `Sample Task ${i+1} for ${project.projectName}`,
            description: `This is a sample task created for the project ${project.projectName}`,
            status: taskStatuses[i],
            priority: taskPriorities[i],
            dueDate: new Date(Date.now() + (i+1) * 24 * 60 * 60 * 1000), // Due in i+1 days
            project: project._id,
            createdBy: project.owner, // Assign the project owner as the creator
          });
          
          await task.save();
          taskIds.push(task._id);
          console.log(`Created task ${task.title} with ID ${task._id}`);
        }
        
        // Update the project with the new task IDs
        await Project.findByIdAndUpdate(
          project._id,
          { $set: { tasks: taskIds } }
        );
        
        console.log(`Updated project ${project.projectName} with ${taskIds.length} tasks`);
      }
      
      console.log("Script completed successfully");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  })
  .catch(err => {
    console.error("Error connecting to MongoDB:", err);
  });
