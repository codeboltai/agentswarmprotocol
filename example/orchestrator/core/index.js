const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const { setupServices } = require('../utils/services/services');
const { AgentRegistry } = require('../agent/agent-registry');
const { TaskRegistry } = require('../utils/tasks/task-registry');
const { AgentServer } = require('../agent/agent-server');
const { ClientServer } = require('../client/client-server');
const { MessageHandler } = require('./message-handler');

// Load environment variables
require('dotenv').config({ path: '../.env' });

/**
 * Orchestrator - Main coordinator for the Agent Swarm Protocol
 * Manages communication between agents and clients through dedicated servers
 */
class Orchestrator {
  constructor(config = {}) {
    this.port = config.port || process.env.PORT || 3000;
    this.clientPort = config.clientPort || process.env.CLIENT_PORT || 3001;
    this.logLevel = config.logLevel || process.env.LOG_LEVEL || 'info';
    this.agents = new AgentRegistry();
    this.services = setupServices(config);
    this.tasks = new TaskRegistry();
    this.pendingResponses = {}; // Track pending responses
    
    // Create event bus for communication between components
    this.eventBus = new EventEmitter();
    
    // Create message handler to centralize business logic
    this.messageHandler = new MessageHandler({
      agents: this.agents,
      tasks: this.tasks,
      services: this.services,
      eventBus: this.eventBus
    });
    
    // Create servers with specific dependencies rather than passing the entire orchestrator
    this.agentServer = new AgentServer(
      { agents: this.agents }, 
      this.eventBus, 
      config
    );
    
    this.clientServer = new ClientServer(
      this.eventBus, 
      config
    );
    
    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for task created events
    this.eventBus.on('task.created', (taskId, agentId, clientId, taskData) => {
      console.log(`Task ${taskId} created for agent ${agentId} by client ${clientId}`);
    });
    
    // Listen for agent-to-agent request events
    this.eventBus.on('agent.request', (taskId, targetAgentId, requestingAgentId, taskMessage) => {
      console.log(`Agent ${requestingAgentId} requesting task ${taskId} from agent ${targetAgentId}`);
      
      // Get the connections needed
      const targetAgent = this.agents.getAgentById(targetAgentId);
      if (targetAgent && targetAgent.connection) {
        // Send the task to the target agent
        this.sendAndWaitForResponse(targetAgent.connection, taskMessage)
          .then(response => {
            // Task completed by target agent
            this.tasks.updateTaskStatus(taskId, 'completed', response);
            this.eventBus.emit('response.message', response);
          })
          .catch(error => {
            // Task failed
            console.error(`Error in agent-to-agent request: ${error.message}`);
            this.tasks.updateTaskStatus(taskId, 'failed', { error: error.message });
          });
      }
    });
    
    // Handle agent registration
    this.eventBus.on('agent.register', (message, connectionId, callback) => {
      try {
        const result = this.messageHandler.handleAgentRegistration(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle service requests
    this.eventBus.on('service.request', async (message, connectionId, callback) => {
      try {
        const result = await this.messageHandler.handleServiceRequest(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle agent-to-agent requests 
    this.eventBus.on('agent.request.received', (message, connectionId, callback) => {
      try {
        const result = this.messageHandler.handleAgentRequest(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle task results
    this.eventBus.on('task.result.received', (message) => {
      this.messageHandler.handleTaskResult(message);
    });
    
    // Handle task errors
    this.eventBus.on('task.error.received', (message) => {
      this.messageHandler.handleTaskError(message);
    });
    
    // Listen for agent disconnection events
    this.eventBus.on('agent.disconnected', (connectionId) => {
      this.messageHandler.handleAgentDisconnected(connectionId);
    });
    
    // Listen for agent status changes
    this.eventBus.on('agent.status_changed', (agentId, status) => {
      console.log(`Agent ${agentId} status changed to ${status}`);
    });
    
    // Listen for response messages
    this.eventBus.on('response.message', (message) => {
      this.handleResponseMessage(message);
    });
    
    // Handle client task creation requests
    this.eventBus.on('client.task.create', async (message, clientId, callback) => {
      try {
        const result = await this.messageHandler.handleTaskCreation(message, clientId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle client task status requests
    this.eventBus.on('client.task.status', (taskId, callback) => {
      try {
        const result = this.messageHandler.getTaskStatus(taskId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle client agent list requests
    this.eventBus.on('client.agent.list', (filters, callback) => {
      try {
        const result = this.messageHandler.getAgentList(filters);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
  }

  async start() {
    // Start agent server
    await this.agentServer.start();
    
    // Start client server
    await this.clientServer.start();
    
    console.log('Agent Swarm Protocol Orchestrator fully started');
    return this;
  }

  // Helper method to send a message and wait for a response
  async sendAndWaitForResponse(ws, message, options = {}) {
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    return new Promise((resolve, reject) => {
      // Generate an ID if not present
      if (!message.id) {
        message.id = uuidv4();
      }
      
      const messageId = message.id;
      
      // Initialize pending responses for this ID if it doesn't exist
      if (!this.pendingResponses[messageId]) {
        this.pendingResponses[messageId] = [];
      }
      
      // Set a timeout
      const timeoutId = setTimeout(() => {
        // Check if we still have callbacks for this message
        if (this.pendingResponses[messageId]) {
          // Remove this specific callback
          const index = this.pendingResponses[messageId].findIndex(cb => cb === responseCallback);
          if (index !== -1) {
            this.pendingResponses[messageId].splice(index, 1);
          }
          
          // If no more callbacks, delete the entry
          if (this.pendingResponses[messageId].length === 0) {
            delete this.pendingResponses[messageId];
          }
          
          reject(new Error(`Response timeout for message ID ${messageId}`));
        }
      }, timeout);
      
      // Define the response callback
      const responseCallback = (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      };
      
      // Add the callback to the list
      this.pendingResponses[messageId].push(responseCallback);
      
      // Send the message
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // Handle response messages and trigger callbacks
  handleResponseMessage(message) {
    const requestId = message.requestId;
    
    if (requestId && this.pendingResponses[requestId]) {
      this.pendingResponses[requestId].forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in response callback:', error);
        }
      });
      
      // Remove the callbacks
      delete this.pendingResponses[requestId];
    }
  }

  // Forward task result to client
  forwardTaskResultToClient(clientId, taskId, content) {
    this.eventBus.emit('task.result', clientId, taskId, content);
  }

  // Forward task error to client
  forwardTaskErrorToClient(clientId, message) {
    this.eventBus.emit('task.error', clientId, message);
  }

  stop() {
    // Stop agent server
    this.agentServer.stop();
    
    // Stop client server
    this.clientServer.stop();
    
    console.log('Agent Swarm Protocol Orchestrator stopped');
  }
}

// Start the orchestrator if this is the main module
if (require.main === module) {
  const orchestrator = new Orchestrator();
  orchestrator.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down Agent Swarm Protocol Orchestrator...');
    orchestrator.stop();
    process.exit(0);
  });
}

module.exports = { Orchestrator }; 