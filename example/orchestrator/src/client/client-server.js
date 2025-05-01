const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

/**
 * ClientServer - Handles WebSocket communication with clients
 */
class ClientServer {
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus;
    this.clientPort = config.clientPort || process.env.CLIENT_PORT || 3001;
    this.clientConnections = new Map(); // Store client connections
    this.pendingResponses = {}; // Track pending responses
    
    // Set up event listeners for client communication
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for task results from agents and forward to clients
    this.eventBus.on('task.result', (clientId, taskId, content) => {
      this.forwardTaskResultToClient(clientId, taskId, content);
    });
    
    // Listen for task errors from agents and forward to clients
    this.eventBus.on('task.error', (clientId, message) => {
      this.forwardTaskErrorToClient(clientId, message);
    });
  }

  async start() {
    // Create HTTP server for clients
    this.clientServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Agent Swarm Protocol Client Interface is running');
    });

    // Create WebSocket server for clients
    this.clientWss = new WebSocket.Server({ server: this.clientServer });
    
    // Handle WebSocket connections from clients
    this.clientWss.on('connection', (ws) => {
      // Generate unique ID for the client connection
      const clientId = uuidv4();
      ws.id = clientId;
      
      console.log(`New client connection established: ${clientId}`);
      this.clientConnections.set(clientId, ws);
      
      // Handle incoming messages from clients
      ws.on('message', async (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          await this.handleClientMessage(parsedMessage, ws);
        } catch (error) {
          console.error('Error handling client message:', error);
          this.sendToClient(ws, {
            type: 'error',
            content: {
              error: 'Error processing message',
              details: error.message
            }
          });
        }
      });
      
      // Handle client disconnections
      ws.on('close', () => {
        console.log(`Client connection closed: ${clientId}`);
        this.clientConnections.delete(clientId);
      });
      
      // Send welcome message to client
      this.sendToClient(ws, {
        type: 'orchestrator.welcome',
        content: {
          message: 'Connected to ASP Client Interface',
          clientId: clientId,
          orchestratorVersion: '1.0.0'
        }
      });
    });
    
    // Start HTTP server for clients
    this.clientServer.listen(this.clientPort, () => {
      console.log(`ASP Client Interface running on port ${this.clientPort} (for clients)`);
    });

    return this;
  }

  // Handle messages from clients
  async handleClientMessage(message, ws) {
    console.log(`Received client message: ${JSON.stringify(message)}`);
    
    if (!message.type) {
      return this.sendToClient(ws, {
        type: 'error',
        content: {
          error: 'Invalid message format',
          details: 'Message type is required'
        }
      });
    }
    
    try {
      switch (message.type) {
        case 'task.create':
          await this.handleClientTaskCreation(message, ws);
          break;
          
        case 'task.status':
          await this.handleClientTaskStatus(message, ws);
          break;
          
        case 'agent.list':
          await this.handleClientAgentList(message, ws);
          break;
          
        case 'mcp.server.list':
          await this.handleClientMCPServerList(message, ws);
          break;
          
        case 'mcp.server.register':
          await this.handleClientMCPServerRegister(message, ws);
          break;
          
        default:
          this.sendToClient(ws, {
            type: 'error',
            content: {
              error: 'Unsupported message type',
              details: `Message type '${message.type}' is not supported`
            }
          });
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      this.sendToClient(ws, {
        type: 'error',
        content: {
          error: 'Error processing message',
          details: error.message
        }
      });
    }
  }
  
  // Handle task creation request from client
  async handleClientTaskCreation(message, ws) {
    // Emit task creation event and wait for response
    this.eventBus.emit('client.task.create', message, ws.id, (result) => {
      if (result.error) {
        this.sendToClient(ws, {
          type: 'error',
          id: message.id,
          content: {
            error: 'Error creating task',
            details: result.error
          }
        });
        return;
      }
      
      // Notify client of task creation
      this.sendToClient(ws, {
        type: 'task.created',
        id: message.id,
        content: result
      });
    });
  }
  
  // Handle task status request from client
  async handleClientTaskStatus(message, ws) {
    // Emit task status request event
    this.eventBus.emit('client.task.status', message.content.taskId, (result) => {
      if (result.error) {
        this.sendToClient(ws, {
          type: 'error',
          id: message.id,
          content: {
            error: 'Error getting task status',
            details: result.error
          }
        });
        return;
      }
      
      this.sendToClient(ws, {
        type: 'task.status',
        id: message.id,
        content: result
      });
    });
  }
  
  // Handle agent list request from client
  async handleClientAgentList(message, ws) {
    // Emit agent list request event
    this.eventBus.emit('client.agent.list', {}, (result) => {
      if (result.error) {
        this.sendToClient(ws, {
          type: 'error',
          id: message.id,
          content: {
            error: 'Error getting agent list',
            details: result.error
          }
        });
        return;
      }
      
      this.sendToClient(ws, {
        type: 'agent.list',
        id: message.id,
        content: {
          agents: result
        }
      });
    });
  }
  
  // Handle MCP server list request from client
  async handleClientMCPServerList(message, ws) {
    console.log(`Processing MCP server list request: ${JSON.stringify(message)}`);
    
    // Emit MCP server list request event
    this.eventBus.emit('client.mcp.server.list', message.content?.filters || {}, (result) => {
      console.log(`Received MCP server list result: ${JSON.stringify(result)}`);
      
      if (result.error) {
        this.sendToClient(ws, {
          type: 'error',
          id: message.id, // Use id for consistency
          content: {
            error: 'Error getting MCP server list',
            details: result.error
          }
        });
        return;
      }
      
      this.sendToClient(ws, {
        type: 'mcp.server.list',
        id: message.id, // Use id for consistency
        content: {
          servers: result
        }
      });
    });
  }
  
  // Handle MCP server registration request from client
  async handleClientMCPServerRegister(message, ws) {
    console.log(`Processing MCP server registration request: ${JSON.stringify(message)}`);
    
    // Emit MCP server registration request event
    this.eventBus.emit('client.mcp.server.register', message.content, (result) => {
      console.log(`Received MCP server registration result: ${JSON.stringify(result)}`);
      
      if (result.error) {
        this.sendToClient(ws, {
          type: 'error',
          id: message.id, // Use id for consistency
          content: {
            error: 'Error registering MCP server',
            details: result.error
          }
        });
        return;
      }
      
      this.sendToClient(ws, {
        type: 'mcp.server.registered',
        id: message.id, // Use id for consistency
        content: result
      });
    });
  }
  
  // Send message to client
  sendToClient(ws, message) {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return message.id;
    } else {
      console.error('WebSocket not open, cannot send message to client');
      return null;
    }
  }

  // Forward task result to client
  forwardTaskResultToClient(clientId, taskId, content) {
    if (this.clientConnections.has(clientId)) {
      const clientWs = this.clientConnections.get(clientId);
      this.sendToClient(clientWs, {
        type: 'task.result',
        content: {
          taskId,
          result: content
        }
      });
    }
  }

  // Forward task error to client
  forwardTaskErrorToClient(clientId, message) {
    if (this.clientConnections.has(clientId)) {
      const clientWs = this.clientConnections.get(clientId);
      this.sendToClient(clientWs, {
        type: 'task.error',
        content: {
          taskId: message.requestId,
          error: message.content.error
        }
      });
    }
  }

  // Get client connection by ID
  getClientConnection(clientId) {
    return this.clientConnections.get(clientId);
  }

  // Check if client is connected
  hasClientConnection(clientId) {
    return this.clientConnections.has(clientId);
  }

  stop() {
    if (this.clientServer) {
      this.clientServer.close();
      console.log('Client WebSocket server closed');
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
}

module.exports = { ClientServer }; 