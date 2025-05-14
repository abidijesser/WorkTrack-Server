const Task = require("../models/Task");
const mongoose = require("mongoose");

// Get upcoming deadlines for tasks
const getUpcomingDeadlines = async (req, res) => {
  try {
    // Get the current date
    const currentDate = new Date();
    
    // Set the date range for upcoming deadlines (next 7 days)
    const endDate = new Date();
    endDate.setDate(currentDate.getDate() + 7);
    
    // Find tasks with deadlines in the next 7 days that are not completed
    const upcomingTasks = await Task.find({
      dueDate: { $gte: currentDate, $lte: endDate },
      status: { $ne: "Done" } // Exclude completed tasks
    })
    .populate("assignedTo", "name email")
    .populate("project", "projectName")
    .sort({ dueDate: 1 }) // Sort by closest deadline first
    .limit(10); // Limit to 10 tasks
    
    // Calculate days remaining for each task
    const tasksWithDaysRemaining = upcomingTasks.map(task => {
      const dueDate = new Date(task.dueDate);
      const timeDiff = dueDate.getTime() - currentDate.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        daysRemaining: daysRemaining,
        assignedTo: task.assignedTo,
        project: task.project
      };
    });
    
    res.status(200).json({
      success: true,
      count: tasksWithDaysRemaining.length,
      tasks: tasksWithDaysRemaining
    });
  } catch (error) {
    console.error("Error fetching upcoming deadlines:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching upcoming deadlines",
      details: error.message
    });
  }
};

module.exports = {
  getUpcomingDeadlines
};
