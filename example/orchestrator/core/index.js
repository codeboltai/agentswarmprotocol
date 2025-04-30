const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { setupServices } = require('./services');
const { AgentRegistry } = require('./agent-registry');
const { TaskRegistry } = require('./task-registry');
const { AgentServer } = require('./agent-server');
const { ClientServer } = require('./client-server');

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
    
    // Create servers
    this.agentServer = new AgentServer(this, config);
    this.clientServer = new ClientServer(this, config);
  }

  async start() {
    // Start agent server
    await this.agentServer.start();
    
    // Start client server
    await this.clientServer.start();
    
    console.log('ASP Orchestrator fully started');
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
    this.clientServer.forwardTaskResultToClient(clientId, taskId, content);
  }

  // Forward task error to client
  forwardTaskErrorToClient(clientId, message) {
    this.clientServer.forwardTaskErrorToClient(clientId, message);
  }

  stop() {
    // Stop agent server
    this.agentServer.stop();
    
    // Stop client server
    this.clientServer.stop();
    
    console.log('ASP Orchestrator stopped');
  }
}

// Start the orchestrator if this is the main module
if (require.main === module) {
  const orchestrator = new Orchestrator();
  orchestrator.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down ASP Orchestrator...');
    orchestrator.stop();
    process.exit(0);
  });
}

module.exports = Orchestrator; 