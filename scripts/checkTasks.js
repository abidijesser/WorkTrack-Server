const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
require("dotenv").config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Function to check tasks
const checkTasks = async () => {
  try {
    console.log("Checking all tasks...");

    // Get all tasks
    const tasks = await Task.find({}).populate("assignedTo", "name email");

    console.log(`Total tasks: ${tasks.length}`);

    // Check each task
    tasks.forEach((task) => {
      console.log(`Task ID: ${task._id}`);
      console.log(`Title: ${task.title}`);
      console.log(
        `AssignedTo: ${task.assignedTo ? task.assignedTo.name : "Not assigned"}`
      );
      console.log("-------------------");
    });

    process.exit(0);
  } catch (error) {
    console.error("Error checking tasks:", error);
    process.exit(1);
  }
};

// Run the function
checkTasks();
