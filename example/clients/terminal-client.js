#!/usr/bin/env node
/**
 * Terminal Client for Agent Swarm Protocol
 * A command-line interface to interact with the ASP Orchestrator
 * Using the SwarmClientSDK
 */

const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('../sdk');
require('dotenv').config({ path: '../.env' });

// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Client state
const state = {
  running: false,
  agents: [],
  tasks: {},
  client: null
};

// Helper for asking questions
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Connect to the orchestrator
async function connect() {
  console.log(`Connecting to orchestrator at ${ORCHESTRATOR_URL}...`);
  
  // Initialize the client SDK
  state.client = createClient({
    orchestratorUrl: ORCHESTRATOR_URL,
    autoReconnect: true
  });
  
  // Set up event handlers
  state.client.on('connected', () => {
    console.log('Connected to orchestrator');
  });
  
  state.client.on('disconnected', () => {
    console.log('Disconnected from orchestrator');
    
    // Ask to reconnect if not exiting
    if (state.running) {
      console.log('Connection closed. Reconnect? (y/n)');
      ask('> ').then(answer => {
        if (answer.toLowerCase() === 'y') {
          connect().catch(error => {
            console.error('Failed to reconnect:', error);
            state.running = false;
            rl.close();
          });
        } else {
          state.running = false;
          rl.close();
        }
      });
    }
  });
  
  state.client.on('welcome', (content) => {
    console.log(`Connected as client: ${content.clientId}`);
  });
  
  state.client.on('agent-list', (agents) => {
    state.agents = agents;
    displayAgentList();
  });
  
  state.client.on('task-result', (content) => {
    console.log('\n✅ Task completed!');
    console.log('Result:', JSON.stringify(content.result, null, 2));
    
    // Store task result
    if (content.taskId) {
      state.tasks[content.taskId] = {
        status: 'completed',
        result: content.result,
        completedAt: new Date().toISOString()
      };
    }
  });
  
  state.client.on('task-status', (content) => {
    displayTaskStatus(content);
  });
  
  state.client.on('orchestrator-error', (content) => {
    console.error('\n❌ Error:', content.error);
    if (content.details) {
      console.error('Details:', content.details);
    }
  });
  
  state.client.on('message', () => {
    displayPrompt();
  });
  
  state.client.on('error', (error) => {
    console.error('Client error:', error);
  });
  
  // Connect to the orchestrator
  await state.client.connect();
}

// Display the agent list
function displayAgentList() {
  console.log('\nAvailable Agents:');
  console.log('--------------------------------------------------------------');
  console.log('ID\t\t\t\tName\t\tStatus\tCapabilities');
  console.log('--------------------------------------------------------------');
  
  state.agents.forEach(agent => {
    console.log(
      `${agent.id.substring(0, 8)}...\t${agent.name}\t\t${agent.status}\t${agent.capabilities.join(', ')}`
    );
  });
  
  console.log('--------------------------------------------------------------');
}

// Display task status
function displayTaskStatus(taskInfo) {
  console.log('\nTask Status:');
  console.log('--------------------------------------------------------------');
  console.log(`Task ID: ${taskInfo.taskId}`);
  console.log(`Status: ${taskInfo.status}`);
  console.log(`Created: ${taskInfo.createdAt}`);
  
  if (taskInfo.completedAt) {
    console.log(`Completed: ${taskInfo.completedAt}`);
  }
  
  if (taskInfo.result) {
    console.log('\nResult:');
    console.log(JSON.stringify(taskInfo.result, null, 2));
  }
  
  console.log('--------------------------------------------------------------');
}

// Display the command prompt
function displayPrompt() {
  process.stdout.write('\n> ');
}

// Send a task to an agent
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
    
    // Display agent list
    displayAgentList();
    
    // Select an agent
    const agentName = await ask('Enter agent name: ');
    const selectedAgent = state.agents.find(agent => agent.name === agentName);
    
    if (!selectedAgent) {
      console.log(`❌ Agent not found: ${agentName}`);
      return;
    }
    
    console.log(`Selected agent: ${selectedAgent.name}`);
    
    // Get task data
    console.log('\nEnter task data as JSON (or "cancel" to abort):');
    console.log('Example: { "message": "Hello, agent!", "parameters": { "key": "value" } }');
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
    
    // Send the task using the SDK
    console.log('\nSending task to agent...');
    const response = await state.client.sendTask(selectedAgent.name, taskData);
    
    // Store task for future reference
    if (response.taskId) {
      state.tasks[response.taskId] = {
        agentName: selectedAgent.name,
        status: 'completed',
        result: response.result,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        taskData
      };
      
      console.log(`\nTask ID: ${response.taskId}`);
    }
    
  } catch (error) {
    console.error('❌ Error sending task:', error.message);
  }
}

// Check task status
async function checkTaskStatus() {
  try {
    const taskId = await ask('Enter task ID: ');
    
    if (!taskId) {
      console.log('Operation cancelled');
      return;
    }
    
    // Send task status request using the SDK
    await state.client.getTaskStatus(taskId);
    
  } catch (error) {
    console.error('❌ Error checking task status:', error.message);
  }
}

// List available agents
async function listAgents() {
  try {
    state.agents = await state.client.getAgents();
    displayAgentList();
  } catch (error) {
    console.error('❌ Error listing agents:', error.message);
  }
}

// Show help menu
function showHelp() {
  console.log('\nAvailable commands:');
  console.log('--------------------------------------------------------------');
  console.log('agents                 - List available agents');
  console.log('task                   - Send a task to an agent');
  console.log('status <task_id>       - Check task status');
  console.log('help                   - Show this help menu');
  console.log('exit, quit             - Exit the client');
  console.log('--------------------------------------------------------------');
}

// Main CLI loop
async function main() {
  state.running = true;
  
  console.log('ASP Terminal Client');
  console.log('==================');
  
  try {
    // Connect to orchestrator
    await connect();
    
    showHelp();
    
    // Command loop
    while (state.running) {
      const command = await ask('\n> ');
      
      // Process the command
      if (command === 'exit' || command === 'quit') {
        state.running = false;
      } else if (command === 'agents') {
        await listAgents();
      } else if (command === 'task') {
        await sendTask();
      } else if (command.startsWith('status')) {
        await checkTaskStatus();
      } else if (command === 'help') {
        showHelp();
      } else if (command.trim() === '') {
        // Ignore empty commands
      } else {
        console.log(`Unknown command: ${command}`);
        showHelp();
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (state.client) {
      state.client.disconnect();
    }
    rl.close();
    console.log('Goodbye!');
  }
}

// Start the client
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 