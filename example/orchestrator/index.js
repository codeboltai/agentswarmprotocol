const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { setupServices } = require('./services');
const { AgentRegistry } = require('./agent-registry');
const { TaskRegistry } = require('./task-registry');

// Load environment variables
require('dotenv').config({ path: '../.env' });

class Orchestrator {
  constructor(config = {}) {
    this.port = config.port || process.env.PORT || 3000;
    this.clientPort = config.clientPort || process.env.CLIENT_PORT || 3001;
    this.logLevel = config.logLevel || process.env.LOG_LEVEL || 'info';
    this.agents = new AgentRegistry();
    this.services = setupServices(config);
    this.tasks = new TaskRegistry();
    this.clientConnections = new Map(); // Store client connections
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
        this.agents.removeAgentByConnectionId(connectionId);
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

  async handleMessage(message, ws) {
    console.log(`Received message: ${JSON.stringify(message)}`);
    
    if (!message.type) {
      return this.sendError(ws, 'Invalid message format: type is required', message.id);
    }
    
    switch (message.type) {
      case 'agent.register':
        await this.handleAgentRegistration(message, ws);
        break;
        
      case 'service.request':
        await this.handleServiceRequest(message, ws);
        break;
        
      case 'agent.request':
        await this.handleAgentRequest(message, ws);
        break;
        
      case 'task.result':
        this.handleTaskResult(message);
        this.handleResponseMessage(message);
        break;
        
      case 'task.error':
        // Handle task error and forward to client
        if (message.requestId && this.tasks.hasTask(message.requestId)) {
          const task = this.tasks.updateTaskStatus(message.requestId, 'failed', message.content);
          
          if (task.clientId && this.clientConnections.has(task.clientId)) {
            const clientWs = this.clientConnections.get(task.clientId);
            this.sendToClient(clientWs, {
              type: 'task.error',
              content: {
                taskId: message.requestId,
                error: message.content.error
              }
            });
          }
        }
        this.handleResponseMessage(message);
        break;
        
      default:
        console.warn(`Unhandled message type: ${message.type}`);
    }
  }

  handleAgentRegistration(message, ws) {
    const { name, capabilities, manifest } = message.content;
    
    if (!name) {
      return this.sendError(ws, 'Agent name is required');
    }
    
    // Register the agent
    const agent = {
      id: uuidv4(),
      name,
      capabilities: capabilities || [],
      manifest: manifest || {},
      connection: ws,
      connectionId: ws.id,
      status: 'online',
      registeredAt: new Date().toISOString()
    };
    
    this.agents.registerAgent(agent);
    
    console.log(`Agent registered: ${name} with capabilities: ${agent.capabilities.join(', ')}`);
    
    // Send confirmation
    this.send(ws, {
      type: 'agent.registered',
      content: {
        agentId: agent.id,
        name: agent.name,
        message: 'Agent successfully registered'
      },
      requestId: message.id
    });
  }

  async handleServiceRequest(message, ws) {
    const { service, params } = message.content;
    
    if (!service) {
      return this.sendError(ws, 'Service name is required', message.id);
    }
    
    // Get the agent making the request
    const agent = this.agents.getAgentByConnectionId(ws.id);
    if (!agent) {
      return this.sendError(ws, 'Agent not registered', message.id);
    }
    
    // Check if the service exists
    if (!this.services[service]) {
      return this.sendError(ws, `Service not found: ${service}`, message.id);
    }
    
    // Check if the agent is allowed to use this service
    if (agent.manifest.requiredServices && !agent.manifest.requiredServices.includes(service)) {
      return this.sendError(ws, `Agent is not authorized to use service: ${service}`, message.id);
    }
    
    // Execute the service
    try {
      const result = await this.services[service](params, { agent });
      
      // Send the result back
      this.send(ws, {
        type: 'service.response',
        content: result,
        requestId: message.id
      });
    } catch (error) {
      this.sendError(ws, `Service execution error: ${error.message}`, message.id);
    }
  }

  // New method to handle agent-to-agent requests
  async handleAgentRequest(message, ws) {
    const { targetAgentName, taskData } = message.content;
    
    if (!targetAgentName) {
      return this.sendError(ws, 'Target agent name is required', message.id);
    }
    
    // Get the requesting agent
    const requestingAgent = this.agents.getAgentByConnectionId(ws.id);
    if (!requestingAgent) {
      return this.sendError(ws, 'Requesting agent not registered', message.id);
    }
    
    // Get the target agent
    const targetAgent = this.agents.getAgentByName(targetAgentName);
    if (!targetAgent) {
      return this.sendError(ws, `Target agent not found: ${targetAgentName}`, message.id);
    }
    
    // Check if target agent is online
    if (targetAgent.status !== 'online') {
      return this.sendError(ws, `Target agent is not available: ${targetAgentName} (status: ${targetAgent.status})`, message.id);
    }
    
    // Create a task for the target agent
    const taskId = uuidv4();
    const taskMessage = {
      id: taskId,
      type: 'task.execute',
      content: {
        input: taskData,
        metadata: {
          requestingAgentId: requestingAgent.id,
          requestingAgentName: requestingAgent.name,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    // Register task in task registry
    this.tasks.registerTask(taskId, {
      agentId: targetAgent.id,
      requestingAgentId: requestingAgent.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      taskData
    });
    
    try {
      // Send task to target agent
      const response = await this.sendAndWaitForResponse(targetAgent.connection, taskMessage);
      
      // Update task status
      this.tasks.updateTaskStatus(taskId, 'completed', response);
      
      // Send the result back to the requesting agent
      this.send(ws, {
        type: 'agent.response',
        content: response.content,
        requestId: message.id
      });
    } catch (error) {
      this.sendError(ws, `Error processing agent request: ${error.message}`, message.id);
    }
  }

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
      
      // Send the message
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
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
        
      default:
        this.sendToClient(ws, {
          type: 'error',
          content: {
            error: 'Unsupported message type',
            details: `Message type '${message.type}' is not supported`
          }
        });
    }
  }
  
  // Handle task creation request from client
  async handleClientTaskCreation(message, ws) {
    const { agentName, taskData } = message.content;
    
    if (!agentName || !taskData) {
      return this.sendToClient(ws, {
        type: 'error',
        content: {
          error: 'Invalid task creation request',
          details: 'Both agentName and taskData are required'
        }
      });
    }
    
    // Find the agent by name
    const agent = this.agents.getAgentByName(agentName);
    if (!agent) {
      return this.sendToClient(ws, {
        type: 'error',
        content: {
          error: 'Agent not found',
          details: `No agent found with name '${agentName}'`
        }
      });
    }
    
    try {
      // Create a task
      const taskId = uuidv4();
      const taskMessage = {
        id: taskId,
        type: 'task.execute',
        content: {
          input: taskData,
          metadata: {
            clientId: ws.id,
            timestamp: new Date().toISOString()
          }
        }
      };
      
      // Register task in task registry
      this.tasks.registerTask(taskId, {
        agentId: agent.id,
        clientId: ws.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        taskData
      });
      
      // Send task to agent
      const response = await this.sendAndWaitForResponse(agent.connection, taskMessage);
      
      // Update task status
      this.tasks.updateTaskStatus(taskId, 'completed', response);
      
      // Notify client
      this.sendToClient(ws, {
        type: 'task.result',
        id: message.id,
        content: {
          taskId,
          result: response.content
        }
      });
      
    } catch (error) {
      console.error('Error processing client task:', error);
      this.sendToClient(ws, {
        type: 'error',
        id: message.id,
        content: {
          error: 'Error processing task',
          details: error.message
        }
      });
    }
  }
  
  // Handle task status request from client
  async handleClientTaskStatus(message, ws) {
    const { taskId } = message.content;
    
    if (!taskId) {
      return this.sendToClient(ws, {
        type: 'error',
        id: message.id,
        content: {
          error: 'Invalid task status request',
          details: 'Task ID is required'
        }
      });
    }
    
    try {
      const task = this.tasks.getTask(taskId);
      
      this.sendToClient(ws, {
        type: 'task.status',
        id: message.id,
        content: {
          taskId,
          status: task.status,
          result: task.result,
          createdAt: task.createdAt,
          completedAt: task.completedAt
        }
      });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        id: message.id,
        content: {
          error: 'Error getting task status',
          details: error.message
        }
      });
    }
  }
  
  // Handle agent list request from client
  async handleClientAgentList(message, ws) {
    try {
      const agents = this.agents.getAllAgents().map(agent => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        capabilities: agent.capabilities
      }));
      
      this.sendToClient(ws, {
        type: 'agent.list',
        id: message.id,
        content: {
          agents
        }
      });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        id: message.id,
        content: {
          error: 'Error getting agent list',
          details: error.message
        }
      });
    }
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

  // Extend to handle task.result messages from agents to update task status and forward to clients
  handleTaskResult(message) {
    const { requestId, content } = message;
    
    if (requestId && this.tasks.hasTask(requestId)) {
      // Update task status
      const task = this.tasks.updateTaskStatus(requestId, 'completed', content);
      
      // Forward result to client if still connected
      if (task.clientId && this.clientConnections.has(task.clientId)) {
        const clientWs = this.clientConnections.get(task.clientId);
        this.sendToClient(clientWs, {
          type: 'task.result',
          content: {
            taskId: requestId,
            result: content
          }
        });
      }
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('Agent WebSocket server closed');
    }
    
    if (this.clientServer) {
      this.clientServer.close();
      console.log('Client WebSocket server closed');
    }
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