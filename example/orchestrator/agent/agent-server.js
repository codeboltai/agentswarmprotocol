const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

/**
 * AgentServer - Handles WebSocket communication with agents
 */
class AgentServer {
  constructor(orchestrator, config = {}) {
    this.orchestrator = orchestrator;
    this.port = config.port || process.env.PORT || 3000;
    this.agents = orchestrator.agents;
    this.services = orchestrator.services;
    this.tasks = orchestrator.tasks;
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

    return this;
  }

  async handleMessage(message, ws) {
    console.log(`Received agent message: ${JSON.stringify(message)}`);
    
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
        this.orchestrator.handleResponseMessage(message);
        break;
        
      case 'task.error':
        // Handle task error and forward to client
        if (message.requestId && this.tasks.hasTask(message.requestId)) {
          const task = this.tasks.updateTaskStatus(message.requestId, 'failed', message.content);
          
          if (task.clientId) {
            this.orchestrator.forwardTaskErrorToClient(task.clientId, message);
          }
        }
        this.orchestrator.handleResponseMessage(message);
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

  // Method to handle agent-to-agent requests
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
      const response = await this.orchestrator.sendAndWaitForResponse(targetAgent.connection, taskMessage);
      
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

  // Extend to handle task.result messages from agents to update task status and forward to clients
  handleTaskResult(message) {
    const { requestId, content } = message;
    
    if (requestId && this.tasks.hasTask(requestId)) {
      // Update task status
      const task = this.tasks.updateTaskStatus(requestId, 'completed', content);
      
      // Forward result to client if still connected
      if (task.clientId) {
        this.orchestrator.forwardTaskResultToClient(task.clientId, requestId, content);
      }
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

  stop() {
    if (this.server) {
      this.server.close();
      console.log('Agent WebSocket server closed');
    }
  }
}

module.exports = { AgentServer }; 