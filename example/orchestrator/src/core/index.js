const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const { AgentRegistry } = require('../agent/agent-registry');
const { TaskRegistry } = require('./utils/tasks/task-registry');
const { ServiceRegistry } = require('../service/service-registry');
const { ServiceTaskRegistry } = require('../service/service-task-registry');
const { AgentServer } = require('../agent/agent-server');
const { ClientServer } = require('../client/client-server');
const { ServiceServer } = require('../service/service-server');
const { MessageHandler } = require('./message-handler');
const mcp = require('./utils/mcp');
const ConfigLoader = require('./utils/config-loader');

// Load environment variables
require('dotenv').config({ path: '../.env' });

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++; // Skip the value
      } else {
        result[key] = true;
      }
    }
  }
  
  return result;
}

/**
 * Orchestrator - Main coordinator for the Agent Swarm Protocol
 * Manages communication between agents and clients through dedicated servers
 */
class Orchestrator {
  constructor(config = {}) {
    // Check for command-line arguments
    const cliArgs = parseArgs();
    
    // Apply command-line arguments to config
    if (cliArgs.config) {
      console.log(`Using configuration file from command line: ${cliArgs.config}`);
      config.configPath = cliArgs.config;
    }
    
    if (cliArgs.agentPort) {
      config.port = parseInt(cliArgs.agentPort, 10);
    }
    
    if (cliArgs.clientPort) {
      config.clientPort = parseInt(cliArgs.clientPort, 10);
    }
    
    if (cliArgs.servicePort) {
      config.servicePort = parseInt(cliArgs.servicePort, 10);
    }
    
    if (cliArgs.logLevel) {
      config.logLevel = cliArgs.logLevel;
    }
    
    // Load configuration
    this.configLoader = new ConfigLoader({
      configPath: config.configPath
    });
    
    // Load and merge configurations
    const loadedConfig = this.configLoader.mergeWithOptions(config);
    const orchestratorSettings = this.configLoader.getOrchestratorSettings();
    
    this.port = config.port || orchestratorSettings.agentPort || process.env.PORT || 3000;
    this.clientPort = config.clientPort || orchestratorSettings.clientPort || process.env.CLIENT_PORT || 3001;
    this.servicePort = config.servicePort || orchestratorSettings.servicePort || process.env.SERVICE_PORT || 3002;
    this.logLevel = config.logLevel || orchestratorSettings.logLevel || process.env.LOG_LEVEL || 'info';
    
    this.agents = new AgentRegistry();
    this.tasks = new TaskRegistry();
    this.services = new ServiceRegistry();
    this.serviceTasks = new ServiceTaskRegistry();
    this.pendingResponses = {}; // Track pending responses
    
    // Create event bus for communication between components
    this.eventBus = new EventEmitter();
    
    // Set up MCP support
    this.mcp = mcp.setup(this.eventBus);
    
    // Create message handler to centralize business logic
    this.messageHandler = new MessageHandler({
      agents: this.agents,
      tasks: this.tasks,
      services: this.services,
      serviceTasks: this.serviceTasks,
      eventBus: this.eventBus,
      mcp: this.mcp
    });
    
    // Create servers with specific dependencies rather than passing the entire orchestrator
    this.agentServer = new AgentServer(
      { agents: this.agents }, 
      this.eventBus, 
      { port: this.port }
    );
    
    this.clientServer = new ClientServer(
      this.eventBus, 
      { clientPort: this.clientPort }
    );
    
    this.serviceServer = new ServiceServer(
      { services: this.services },
      this.eventBus,
      { port: this.servicePort }
    );
    
    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for task created events
    this.eventBus.on('task.created', (taskId, agentId, clientId, taskData) => {
      console.log(`Task ${taskId} created for agent ${agentId} by client ${clientId}`);
      
      // Get the agent connection
      const agent = this.agents.getAgentById(agentId);
      if (agent && agent.connection) {
        // Create a task message to send to the agent
        const taskMessage = {
          id: taskId,
          type: 'task.execute',
          content: {
            ...taskData,
            taskType: taskData.taskType,
            input: taskData.input || taskData,
            metadata: {
              clientId: clientId,
              timestamp: new Date().toISOString()
            }
          }
        };
        
        // Send the task to the agent
        this.sendAndWaitForResponse(agent.connection, taskMessage)
          .then(response => {
            // Task completed by agent
            this.tasks.updateTaskStatus(taskId, 'completed', response);
            this.eventBus.emit('response.message', response);
          })
          .catch(error => {
            // Task failed
            console.error(`Error sending task to agent: ${error.message}`);
            this.tasks.updateTaskStatus(taskId, 'failed', { error: error.message });
          });
      } else {
        console.error(`Cannot send task ${taskId} to agent ${agentId}: Agent not connected`);
        this.tasks.updateTaskStatus(taskId, 'failed', { error: 'Agent not connected' });
      }
    });
    
    // Listen for service task created events
    this.eventBus.on('service.task.created', (taskId, serviceId, agentId, clientId, taskData) => {
      console.log(`Service task ${taskId} created for service ${serviceId} by agent ${agentId}`);
      
      // Get the service connection
      const service = this.services.getServiceById(serviceId);
      if (service && service.connection) {
        // Create a task message to send to the service
        const taskMessage = {
          id: taskId,
          type: 'service.task.execute',
          content: {
            ...taskData,
            functionName: taskData.functionName,
            params: taskData.params || {},
            metadata: {
              agentId: agentId,
              clientId: clientId,
              timestamp: new Date().toISOString()
            }
          }
        };
        
        // Send the task to the service
        this.sendAndWaitForResponse(service.connection, taskMessage)
          .then(response => {
            // Task completed by service
            this.serviceTasks.updateTaskStatus(taskId, 'completed', response);
            this.eventBus.emit('response.message', response);
          })
          .catch(error => {
            // Task failed
            console.error(`Error sending task to service: ${error.message}`);
            this.serviceTasks.updateTaskStatus(taskId, 'failed', { error: error.message });
          });
      } else {
        console.error(`Cannot send task ${taskId} to service ${serviceId}: Service not connected`);
        this.serviceTasks.updateTaskStatus(taskId, 'failed', { error: 'Service not connected' });
      }
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
    
    // Handle service registration
    this.eventBus.on('service.register', (message, connectionId, callback) => {
      try {
        const result = this.messageHandler.handleServiceRegistration(message, connectionId);
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
    
    // Handle service task requests from agents
    this.eventBus.on('service.task.request', async (message, agentId, callback) => {
      try {
        const result = await this.messageHandler.handleServiceTaskRequest(message, agentId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle service task results
    this.eventBus.on('service.task.result.received', (message) => {
      this.messageHandler.handleServiceTaskResult(message);
    });
    
    // Handle service task notifications
    this.eventBus.on('service.task.notification.received', (message) => {
      this.forwardServiceTaskNotificationToClient(message);
      
      // Also forward to the requesting agent
      const taskId = message.content.taskId;
      if (taskId) {
        const task = this.serviceTasks.getTaskById(taskId);
        if (task && task.agentId) {
          this.forwardServiceTaskNotificationToAgent(task.agentId, message);
        }
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
    
    // Handle task notifications
    this.eventBus.on('task.notification.received', (message) => {
      this.forwardTaskNotificationToClient(message);
    });
    
    // Listen for agent disconnection events
    this.eventBus.on('agent.disconnected', (connectionId) => {
      this.messageHandler.handleAgentDisconnected(connectionId);
    });
    
    // Listen for service disconnection events
    this.eventBus.on('service.disconnected', (connectionId) => {
      this.messageHandler.handleServiceDisconnected(connectionId);
    });
    
    // Listen for agent status changes
    this.eventBus.on('agent.status_changed', (agentId, status) => {
      console.log(`Agent ${agentId} status changed to ${status}`);
    });
    
    // Listen for service status changes
    this.eventBus.on('service.status_changed', (serviceId, status) => {
      console.log(`Service ${serviceId} status changed to ${status}`);
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
    
    // Handle client service list requests
    this.eventBus.on('client.service.list', (filters, callback) => {
      try {
        const result = this.messageHandler.getServiceList(filters);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle client MCP server list requests
    this.eventBus.on('client.mcp.server.list', (filters, callback) => {
      try {
        const result = this.mcp.listMCPServers(filters || {});
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
  }

  async start() {
    console.log('Starting Agent Swarm Protocol Orchestrator...');
    
    // Load configuration
    const config = this.configLoader.loadConfig();
    console.log(`Loaded configuration with ${Object.keys(config.mcpServers || {}).length} MCP server(s), ${Object.keys(config.agents || {}).length} agent(s), and ${Object.keys(config.services || {}).length} service(s)`);
    
    // Initialize preconfigured MCP servers from config
    await this.initMCPServersFromConfig();
    
    // Initialize preconfigured agents from config
    await this.initAgentsFromConfig();
    
    // Initialize preconfigured services from config
    await this.initServicesFromConfig();
    
    // Start agent server
    await this.agentServer.start();
    
    // Start client server
    await this.clientServer.start();
    
    // Start service server
    await this.serviceServer.start();
    
    console.log('Agent Swarm Protocol Orchestrator fully started');
    return this;
  }

  /**
   * Initialize MCP servers from configuration
   */
  async initMCPServersFromConfig() {
    const mcpServers = this.configLoader.getMCPServers();
    console.log(`Initializing ${Object.keys(mcpServers).length} preconfigured MCP servers...`);
    
    for (const [id, server] of Object.entries(mcpServers)) {
      try {
        console.log(`Registering MCP server: ${server.name} (${id})`);
        await this.mcp.registerMCPServer({
          id,
          name: server.name,
          command: server.command,
          args: server.args,
          metadata: server.metadata || {}
        });
        console.log(`Successfully registered MCP server: ${server.name}`);
      } catch (error) {
        console.error(`Failed to register MCP server ${id}: ${error.message}`);
      }
    }
  }

  /**
   * Initialize agents from configuration
   */
  async initAgentsFromConfig() {
    const agentConfigs = this.configLoader.getAgents();
    console.log(`Found ${Object.keys(agentConfigs).length} preconfigured agents...`);
    
    // Note: This just prepares configurations. Actual agent registration
    // happens when agents connect to the orchestrator.
    for (const [id, agentConfig] of Object.entries(agentConfigs)) {
      console.log(`Prepared configuration for agent: ${agentConfig.name}`);
      // Store agent configuration for when the agent connects
      this.agents.setAgentConfiguration(id, {
        name: agentConfig.name,
        capabilities: agentConfig.capabilities || [],
        metadata: agentConfig.metadata || {}
      });
    }
  }

  /**
   * Initialize services from configuration
   */
  async initServicesFromConfig() {
    const serviceConfigs = this.configLoader.getServices() || {};
    console.log(`Found ${Object.keys(serviceConfigs).length} preconfigured services...`);
    
    // Note: This just prepares configurations. Actual service registration
    // happens when services connect to the orchestrator.
    for (const [id, serviceConfig] of Object.entries(serviceConfigs)) {
      console.log(`Prepared configuration for service: ${serviceConfig.name}`);
      // Store service configuration for when the service connects
      this.services.setServiceConfiguration(id, {
        name: serviceConfig.name,
        capabilities: serviceConfig.capabilities || [],
        metadata: serviceConfig.metadata || {}
      });
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
    this.clientServer.sendMessage(clientId, {
      type: 'task.result',
      taskId,
      content
    });
  }

  // Forward service task result to agent
  forwardServiceTaskResultToAgent(agentId, taskId, content) {
    const agent = this.agents.getAgentById(agentId);
    if (agent && agent.connection) {
      const message = {
        type: 'service.task.result',
        taskId,
        content
      };
      
      try {
        agent.connection.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error forwarding service task result to agent: ${error.message}`);
      }
    }
  }

  // Forward task error to client
  forwardTaskErrorToClient(clientId, message) {
    this.clientServer.sendMessage(clientId, message);
  }

  // Forward a task notification from an agent to the appropriate client
  forwardTaskNotificationToClient(message) {
    const notification = message.content;
    console.log(`Forwarding task notification: ${notification.message} (${notification.notificationType})`);
    
    let clientId = notification.clientId;
    
    // If no specific client ID is provided, try to find the client from the task
    if (!clientId && notification.taskId) {
      const task = this.tasks.getTaskById(notification.taskId);
      if (task && task.clientId) {
        clientId = task.clientId;
      }
    }
    
    // If we have a specific client to send to
    if (clientId) {
      if (this.clientServer.hasClientConnection(clientId)) {
        const clientWs = this.clientServer.getClientConnection(clientId);
        this.clientServer.sendToClient(clientWs, {
          type: 'task.notification',
          content: notification
        });
      } else {
        console.warn(`Cannot forward notification: Client ${clientId} not connected`);
      }
    } else {
      // Broadcast to all clients if no specific client is targeted
      console.log('Broadcasting notification to all connected clients');
      let clientCount = 0;
      
      // Get all client connections and send the notification to each
      for (const [id, clientWs] of this.clientServer.clientConnections.entries()) {
        this.clientServer.sendToClient(clientWs, {
          type: 'task.notification',
          content: notification
        });
        clientCount++;
      }
      
      console.log(`Notification broadcasted to ${clientCount} clients`);
    }
  }

  // Forward a service task notification to the appropriate client
  forwardServiceTaskNotificationToClient(message) {
    const notification = message.content;
    console.log(`Forwarding service task notification: ${notification.message} (${notification.notificationType})`);
    
    let clientId = notification.clientId;
    
    // If no specific client ID is provided, try to find the client from the task
    if (!clientId && notification.taskId) {
      const task = this.serviceTasks.getTaskById(notification.taskId);
      if (task && task.clientId) {
        clientId = task.clientId;
      }
    }
    
    // If we have a specific client to send to
    if (clientId) {
      if (this.clientServer.hasClientConnection(clientId)) {
        const clientWs = this.clientServer.getClientConnection(clientId);
        this.clientServer.sendToClient(clientWs, {
          type: 'service.notification',
          content: notification
        });
      } else {
        console.warn(`Cannot forward service notification: Client ${clientId} not connected`);
      }
    } else {
      // Broadcast to all clients if no specific client is targeted
      console.log('Broadcasting service notification to all connected clients');
      let clientCount = 0;
      
      // Get all client connections and send the notification to each
      for (const [id, clientWs] of this.clientServer.clientConnections.entries()) {
        this.clientServer.sendToClient(clientWs, {
          type: 'service.notification',
          content: notification
        });
        clientCount++;
      }
      
      console.log(`Service notification broadcasted to ${clientCount} clients`);
    }
  }

  // Forward a service task notification to the requesting agent
  forwardServiceTaskNotificationToAgent(agentId, message) {
    const agent = this.agents.getAgentById(agentId);
    if (agent && agent.connection) {
      const notification = message.content;
      
      try {
        agent.connection.send(JSON.stringify({
          type: 'service.notification',
          content: notification
        }));
      } catch (error) {
        console.error(`Error forwarding service notification to agent: ${error.message}`);
      }
    }
  }

  // Gracefully stop the orchestrator
  async stop() {
    // Stop MCP servers
    const mcpServers = this.mcp.listMCPServers();
    for (const server of mcpServers) {
      if (server.status === 'online') {
        try {
          await this.mcp.disconnectMCPServer(server.id);
        } catch (error) {
          console.error(`Error disconnecting MCP server ${server.name}:`, error);
        }
      }
    }
    
    // Stop agent server
    await this.agentServer.stop();
    
    // Stop client server
    await this.clientServer.stop();
    
    // Stop service server
    await this.serviceServer.stop();
    
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