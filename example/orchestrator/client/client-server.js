const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

/**
 * ClientServer - Handles WebSocket communication with clients
 */
class ClientServer {
  constructor(orchestrator, config = {}) {
    this.orchestrator = orchestrator;
    this.clientPort = config.clientPort || process.env.CLIENT_PORT || 3001;
    this.agents = orchestrator.agents;
    this.tasks = orchestrator.tasks;
    this.clientConnections = new Map(); // Store client connections
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
      const response = await this.orchestrator.sendAndWaitForResponse(agent.connection, taskMessage);
      
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
}

module.exports = { ClientServer }; 