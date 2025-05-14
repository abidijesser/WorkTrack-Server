const mongoose = require("mongoose");
const Task = require("../models/Task");
require("dotenv").config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Function to delete tasks without assignedTo
const deleteUnassignedTasks = async () => {
  try {
    console.log("Searching for tasks without assignedTo...");

    // First, let's find all tasks
    const allTasks = await Task.find({});

    // Filter tasks with invalid assignedTo values
    const tasksToDelete = allTasks.filter((task) => {
      return (
        !task.assignedTo ||
        task.assignedTo === "" ||
        task.assignedTo === null ||
        task.assignedTo === undefined
      );
    });

    console.log(
      `Found ${tasksToDelete.length} tasks without valid assignedTo.`
    );

    if (tasksToDelete.length === 0) {
      console.log("No tasks to delete.");
      process.exit(0);
    }

    // Log the tasks to be deleted
    console.log("Tasks to be deleted:");
    tasksToDelete.forEach((task) => {
      console.log(`- ID: ${task._id}, Title: ${task.title}`);
    });

    // Delete each task individually
    let deletedCount = 0;
    for (const task of tasksToDelete) {
      try {
        await Task.findByIdAndDelete(task._id);
        deletedCount++;
        console.log(`Deleted task: ${task._id}`);
      } catch (err) {
        console.error(`Error deleting task ${task._id}:`, err.message);
      }
    }

    console.log(`Successfully deleted ${deletedCount} tasks.`);
    process.exit(0);
  } catch (error) {
    console.error("Error deleting tasks:", error);
    process.exit(1);
  }
};

// Run the function
deleteUnassignedTasks();
