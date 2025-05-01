/**
 * Connection utilities for the terminal client
 * Handles connecting to the orchestrator and setting up event handlers
 */

const SwarmClientSDK = require('../../sdk/clientsdk');
const state = require('../models/state');
const { rl, ask, displayPrompt } = require('./helpers');
const { displayAgentList, displayMCPServersList, displayTaskStatus } = require('./display');
const chatHandler = require('../handlers/chat-handler');

// Default configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';

/**
 * Connect to the orchestrator
 * @returns {Promise<boolean>} - True if connected successfully, false otherwise
 */
async function connect() {  
  try {
    // Initialize the client SDK
    state.client = new SwarmClientSDK({
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
      displayAgentList(agents);
    });
    
    state.client.on('task-result', (content) => {
      console.log(`Received task result for task ID: ${content.taskId}`);
      
      // If we're in a chat session, handle differently
      if (state.chatState.inChatSession) {
        // Check if this is our current chat task
        if (content.taskId === state.chatState.currentTaskId) {
          chatHandler.handleChatResponse(content);
          return;
        }
        
        // Check if this is our initialization task
        if (content.taskId === state.chatState.initTaskId) {
          console.log(`Received delayed initialization response for task ID: ${content.taskId}`);
          if (content.result && content.result.response) {
            chatHandler.displayInitialResponse(content.result.response);
          }
          return;
        }
      }

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
    
    state.client.on('task-created', (content) => {
      // If we're in a chat session, don't output this
      if (state.chatState.inChatSession && (content.taskId === state.chatState.currentTaskId || content.taskId === state.chatState.initTaskId)) {
        return;
      }

      console.log(`\nTask created with ID: ${content.taskId}`);
      console.log(`Status: ${content.status}`);
      
      // Store task info
      if (content.taskId) {
        state.tasks[content.taskId] = {
          status: content.status,
          createdAt: new Date().toISOString()
        };
      }
    });
    
    state.client.on('task-status', (content) => {
      // If we're in a chat session, don't display this
      if (state.chatState.inChatSession && (content.taskId === state.chatState.currentTaskId || content.taskId === state.chatState.initTaskId)) {
        return;
      }
      displayTaskStatus(content);
    });
    
    state.client.on('orchestrator-error', (content) => {
      console.error('\n❌ Error:', content.error || 'Unknown error');
      if (content.details) {
        console.error('Details:', content.details);
      }
    });
    
    state.client.on('message', (message) => {
      if (state.chatState.inChatSession) {
        // For debugging
        if (message.type !== 'task.created' && message.type !== 'pong') {
          console.log(`Debug - received message in chat: ${JSON.stringify(message)}`);
        }
      } else {
        displayPrompt();
      }
    });
    
    state.client.on('error', (error) => {
      console.error('Client error:', error.message || error);
    });
    
    state.client.on('mcp-server-list', (servers) => {
      state.mcpServers = servers;
      displayMCPServersList(servers);
    });
    
    state.client.on('mcp-server-registered', (content) => {
      console.log('\nMCP Server registered:');
      console.log(`Server ID: ${content.serverId}`);
      console.log(`Name: ${content.name}`);
      console.log(`Status: ${content.status}`);
      
      // Update the servers list
      listMCPServers();
    });
    
    // Connect to the orchestrator
    await state.client.connect();
    return true;
  } catch (error) {
    console.error(`Failed to connect: ${error.message || error}`);
    return false;
  }
}

/**
 * List available MCP servers
 * @returns {Promise<Array>} - Array of MCP servers
 */
async function listMCPServers() {
  try {
    console.log('Fetching MCP servers list...');
    const response = await state.client.sendAndWaitForResponse({
      type: 'mcp.server.list',
      content: { filters: {} }
    });
    
    console.log('Received MCP servers response:', JSON.stringify(response));
    
    if (response && response.content && response.content.servers) {
      state.mcpServers = response.content.servers;
      displayMCPServersList(state.mcpServers);
    } else {
      console.log('No MCP servers data in response');
      state.mcpServers = [];
      displayMCPServersList(state.mcpServers);
    }
    
    return response.content?.servers || [];
  } catch (error) {
    console.error('❌ Error fetching MCP servers:', error.message || error);
    state.mcpServers = [];
    displayMCPServersList(state.mcpServers);
    return [];
  }
}

/**
 * Disconnect from the orchestrator
 */
function disconnect() {
  if (state.client) {
    state.client.disconnect();
  }
}

module.exports = {
  connect,
  disconnect,
  listMCPServers
}; 