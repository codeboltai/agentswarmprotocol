const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

/**
 * AgentServer - Handles WebSocket communication with agents
 * Responsible only for communication layer, not business logic
 */
class AgentServer {
  constructor({ agents }, eventBus, config = {}) {
    this.agents = agents; // Only needed for connection tracking
    this.eventBus = eventBus;
    this.port = config.port || process.env.PORT || 3000;
    this.pendingResponses = {}; // Track pending responses
  }

  async start() {
    // Create HTTP server for agents
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Agent Swarm Protocol Orchestrator is running');
    });

    // Create WebSocket server for agents
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Handle WebSocket connections from agents
    this.wss.on('connection', (ws) => {
      // Generate unique ID for the connection
      const connectionId = uuidv4();
      ws.id = connectionId;
      
      console.log(`New agent connection established: ${connectionId}`);
      
      // Handle incoming messages from agents
      ws.on('message', async (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          await this.handleMessage(parsedMessage, ws);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws, 'Error processing message', error);
        }
      });
      
      // Handle disconnections
      ws.on('close', () => {
        console.log(`Agent connection closed: ${connectionId}`);
        // Emit event for disconnection, let the message handler deal with it
        this.eventBus.emit('agent.disconnected', connectionId);
      });
      
      // Send welcome message
      this.send(ws, {
        type: 'orchestrator.welcome',
        content: {
          message: 'Connected to ASP Orchestrator',
          orchestratorVersion: '1.0.0'
        }
      });
    });
    
    // Start HTTP server for agents
    this.server.listen(this.port, () => {
      console.log(`ASP Orchestrator running on port ${this.port} (for agents)`);
    });

    return this;
  }

  async handleMessage(message, ws) {
    console.log(`Received agent message: ${JSON.stringify(message)}`);
    
    if (!message.type) {
      return this.sendError(ws, 'Invalid message format: type is required', message.id);
    }
    
    try {
      switch (message.type) {
        case 'agent.register':
          // Emit registration event and wait for response
          this.eventBus.emit('agent.register', message, ws.id, (registrationResult) => {
            if (registrationResult.error) {
              this.sendError(ws, registrationResult.error, message.id);
              return;
            }
            
            // Store connection object with the agent
            const agent = this.agents.getAgentById(registrationResult.agentId);
            if (agent) {
              agent.connection = ws;
              this.agents.registerAgent(agent);
            }
            
            // Send confirmation
            this.send(ws, {
              type: 'agent.registered',
              content: registrationResult,
              requestId: message.id
            });
          });
          break;
          
        case 'service.request':
          // Emit service request event
          this.eventBus.emit('service.request', message, ws.id, (serviceResult) => {
            if (serviceResult.error) {
              this.sendError(ws, serviceResult.error, message.id);
              return;
            }
            
            // Send the result back
            this.send(ws, {
              type: 'service.response',
              content: serviceResult,
              requestId: message.id
            });
          });
          break;
          
        case 'agent.request':
          // Emit agent request event
          this.eventBus.emit('agent.request.received', message, ws.id, (result) => {
            if (result.error) {
              this.sendError(ws, result.error, message.id);
              return;
            }
            
            // The actual communication will be handled by event listeners in the orchestrator
            // This just returns a task ID for tracking
            this.send(ws, {
              type: 'agent.request.accepted',
              content: result,
              requestId: message.id
            });
          });
          break;
          
        case 'task.result':
          // Emit task result event
          this.eventBus.emit('task.result.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        case 'task.error':
          // Emit task error event
          this.eventBus.emit('task.error.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        default:
          console.warn(`Unhandled message type: ${message.type}`);
          this.sendError(ws, `Unsupported message type: ${message.type}`, message.id);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(ws, error.message, message.id);
    }
  }

  // Helper method to send messages
  send(ws, message) {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now();
    
    try {
      ws.send(JSON.stringify(message));
      return message.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Helper method to send an error response
  sendError(ws, errorMessage, requestId = null) {
    const message = {
      type: 'error',
      content: {
        error: errorMessage
      }
    };
    
    if (requestId) {
      message.requestId = requestId;
    }
    
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending error message:', error);
    }
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

      // Subscribe to response events
      const responseHandler = (message) => {
        if (message.requestId === messageId) {
          responseCallback(message);
        }
      };
      
      this.eventBus.once('response.message', responseHandler);
      
      // Send the message
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeoutId);
        this.eventBus.removeListener('response.message', responseHandler);
        reject(error);
      }
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('Agent WebSocket server closed');
    }
  }
}

module.exports = { AgentServer }; 