const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const { setupServices } = require('./utils/services/services');
const { AgentRegistry } = require('../agent/agent-registry');
const { TaskRegistry } = require('./utils/tasks/task-registry');
const { AgentServer } = require('../agent/agent-server');
const { ClientServer } = require('../client/client-server');
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
    this.logLevel = config.logLevel || orchestratorSettings.logLevel || process.env.LOG_LEVEL || 'info';
    this.agents = new AgentRegistry();
    this.services = setupServices(config);
    this.tasks = new TaskRegistry();
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
    
    // Handle client MCP server list requests
    this.eventBus.on('client.mcp.server.list', (filters, callback) => {
      try {
        const result = this.mcp.listMCPServers(filters || {});
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle client MCP server registration requests
    this.eventBus.on('client.mcp.server.register', async (content, callback) => {
      try {
        const result = await this.mcp.registerMCPServer(content);
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
    console.log(`Loaded configuration with ${Object.keys(config.mcpServers || {}).length} MCP server(s) and ${Object.keys(config.agents || {}).length} agent(s)`);
    
    // Initialize preconfigured MCP servers from config
    await this.initMCPServersFromConfig();
    
    // Initialize preconfigured agents from config
    await this.initAgentsFromConfig();
    
    // Start agent server
    await this.agentServer.start();
    
    // Start client server
    await this.clientServer.start();
    
    console.log('Agent Swarm Protocol Orchestrator fully started');
    return this;
  }

  /**
   * Initialize MCP servers from configuration
   */
  async initMCPServersFromConfig() {
    const mcpServers = this.configLoader.getMCPServers();
    console.log(`Initializing ${Object.keys(mcpServers).length} preconfigured MCP servers...`);
    console.log('MCP server configurations:', JSON.stringify(mcpServers, null, 2));
    
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

  // Forward task error to client
  forwardTaskErrorToClient(clientId, message) {
    this.clientServer.sendMessage(clientId, message);
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