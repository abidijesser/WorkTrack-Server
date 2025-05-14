const axios = require('axios');
require('dotenv').config();

// Get a valid token from your system
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZDBkMWIxOTM4NTc4NDZhODg4MDNhNyIsImlhdCI6MTc0NTQzOTI0OCwiZXhwIjoxNzQ1NTI1NjQ4fQ.kxOBoEB4VricWQIIFmaFdgbZ7m4XTozx_jvAtMF-Xeo'; // Replace with a valid token

// Create an axios instance
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});

// Function to test getting all tasks
async function getAllTasks() {
  try {
    console.log('Testing GET /tasks');
    const response = await api.get('/tasks');
    console.log('Response status:', response.status);
    console.log('Number of tasks:', response.data.tasks.length);
    
    // Return the first task ID for further testing
    if (response.data.tasks.length > 0) {
      return response.data.tasks[0]._id;
    }
    return null;
  } catch (error) {
    console.error('Error getting tasks:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Function to test getting a task by ID
async function getTaskById(taskId) {
  try {
    console.log(`Testing GET /tasks/${taskId}`);
    const response = await api.get(`/tasks/${taskId}`);
    console.log('Response status:', response.status);
    console.log('Task data:', response.data.task);
    return response.data.task;
  } catch (error) {
    console.error(`Error getting task ${taskId}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Run the tests
async function runTests() {
  try {
    // Test getting all tasks
    const taskId = await getAllTasks();
    
    if (taskId) {
      // Test getting a task by ID
      await getTaskById(taskId);
    } else {
      console.log('No tasks found to test with');
    }
    
    console.log('Tests completed');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests();
