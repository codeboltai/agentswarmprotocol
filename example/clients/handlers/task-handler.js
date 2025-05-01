/**
 * Task handler module for the terminal client
 * Handles task-related functionality with agents
 */

const { select } = require('@inquirer/prompts');
const state = require('../models/state');
const { rl, ask } = require('../utils/helpers');

/**
 * Send a task to an agent
 */
async function sendTask() {
  try {
    // If no agents are loaded, get the list first
    if (state.agents.length === 0) {
      await listAgents();
    }
    
    if (state.agents.length === 0) {
      console.log('❌ No agents available');
      return;
    }
    
    // Get online agents
    const onlineAgents = state.agents.filter(agent => agent.status === 'online');
    
    if (onlineAgents.length === 0) {
      console.log('❌ No online agents available for tasks');
      return;
    }

    // Create agent choices for inquirer
    const agentChoices = onlineAgents.map(agent => ({
      name: `${agent.name} (${agent.capabilities.join(', ')})`,
      value: agent
    }));

    // Temporary pause readline to avoid conflicts with inquirer
    rl.pause();

    // Select an agent using inquirer
    const selectedAgent = await select({
      message: 'Select an agent to send a task to:',
      choices: agentChoices
    });

    // Resume readline
    rl.resume();
    
    console.log(`\nSelected agent: ${selectedAgent.name}`);
    
    // Get task data
    console.log('\nEnter task data as JSON (or "cancel" to abort):');
    console.log('Example: { "taskType": "text-processing", "text": "Hello, world!" }');
    const taskDataStr = await ask('Task data: ');
    
    if (taskDataStr.toLowerCase() === 'cancel') {
      console.log('Task sending cancelled');
      return;
    }
    
    let taskData;
    try {
      taskData = JSON.parse(taskDataStr);
    } catch (error) {
      console.error('❌ Invalid JSON:', error.message);
      return;
    }
    
    // Pause readline for inquirer
    rl.pause();
    
    // Ask if we should wait for the result using inquirer
    const waitForResult = await select({
      message: 'Wait for task result?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false }
      ]
    });
    
    // Resume readline
    rl.resume();
    
    // Send the task using the SDK
    console.log(`\nSending task to agent ${selectedAgent.name}...`);
    const response = await state.client.sendTask(selectedAgent.name, taskData, { 
      waitForResult,
      timeout: 60000 // 60 second timeout
    });
    
    // Store task for future reference
    if (response.taskId) {
      state.tasks[response.taskId] = {
        agentName: selectedAgent.name,
        status: response.status,
        result: response.result,
        createdAt: new Date().toISOString(),
        taskData
      };
      
      if (response.status === 'completed') {
        state.tasks[response.taskId].completedAt = new Date().toISOString();
      }
      
      console.log(`\nTask ID: ${response.taskId}`);
      console.log(`Status: ${response.status}`);
      
      if (response.result) {
        console.log('\nResult:');
        console.log(JSON.stringify(response.result, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error sending task:', error.message);
  }
}

/**
 * Check the status of a task
 */
async function checkTaskStatus() {
  try {
    const taskId = await ask('Enter task ID: ');
    
    if (!taskId) {
      console.log('Operation cancelled');
      return;
    }
    
    // Send task status request using the SDK
    console.log(`Checking status for task ${taskId}...`);
    const status = await state.client.getTaskStatus(taskId);
    
    // Store task info
    if (status) {
      state.tasks[taskId] = {
        ...state.tasks[taskId],
        ...status
      };
    }
    
  } catch (error) {
    console.error('❌ Error checking task status:', error.message);
  }
}

/**
 * List available agents
 * @returns {Promise<Array>} - Array of agents
 */
async function listAgents() {
  try {
    console.log('Fetching agent list...');
    state.agents = await state.client.getAgents();
    return state.agents;
  } catch (error) {
    console.error('❌ Error fetching agents:', error.message);
    return [];
  }
}

module.exports = {
  sendTask,
  checkTaskStatus,
  listAgents
}; 