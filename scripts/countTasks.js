require("dotenv").config();
const mongoose = require("mongoose");
const Task = require("../models/Task");

// MongoDB URI from .env file
const MONGO_URI =
  "mongodb+srv://jasserabidi:Z66RqDSIu80fCkV5@cluster0.eihvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function countTasks() {
  try {
    // Count all tasks
    const totalTasks = await Task.countDocuments();
    console.log(`Total tasks in the database: ${totalTasks}`);

    // Count tasks by status
    const todoTasks = await Task.countDocuments({ status: "To Do" });
    const inProgressTasks = await Task.countDocuments({
      status: "In Progress",
    });
    const doneTasks = await Task.countDocuments({ status: "Done" });

    console.log(`Tasks by status:`);
    console.log(`- To Do: ${todoTasks}`);
    console.log(`- In Progress: ${inProgressTasks}`);
    console.log(`- Done: ${doneTasks}`);
    console.log(`- Total: ${todoTasks + inProgressTasks + doneTasks}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Error counting tasks:", error);
  }
}

// Run the function
countTasks();
