import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { AgentRegistry } from '../agent/agent-registry';
import { TaskRegistry } from './utils/tasks/task-registry';
import { ServiceRegistry } from '../service/service-registry';
import { ServiceTaskRegistry } from '../service/service-task-registry';
import { AgentServer } from '../agent/agent-server';
import { ClientServer } from '../client/client-server';
import { ServiceServer } from '../service/service-server';
import { MessageHandler } from './message-handler';
import * as mcp from './utils/mcp';
import ConfigLoader from './utils/config-loader';
import dotenv from 'dotenv';
import {
  OrchestratorConfig,
  PendingResponse,
  WebSocketWithId,
  SendOptions
} from '@agentswarmprotocol/types/common';

// Load environment variables
dotenv.config({ path: '../.env' });

// Parse command line arguments
function parseArgs(): Record<string, string | boolean | number> {
  const args = process.argv.slice(2);
  const result: Record<string, string | boolean | number> = {};
  
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
  private port: number;
  private clientPort: number;
  private servicePort: number;
  private logLevel: string;
  private agents: AgentRegistry;
  private tasks: TaskRegistry;
  private services: ServiceRegistry;
  private serviceTasks: ServiceTaskRegistry;
  private pendingResponses: Record<string, PendingResponse>;
  private eventBus: EventEmitter;
  private mcp: any;
  private configLoader: ConfigLoader;
  private agentServer: AgentServer;
  private clientServer: ClientServer;
  private serviceServer: ServiceServer;
  private messageHandler: MessageHandler;

  constructor(config: OrchestratorConfig = {}) {
    // Check for command-line arguments
    const cliArgs = parseArgs();
    
    // Apply command-line arguments to config
    if (cliArgs.config && typeof cliArgs.config === 'string') {
      console.log(`Using configuration file from command line: ${cliArgs.config}`);
      config.configPath = cliArgs.config;
    }
    
    if (cliArgs.agentPort && typeof cliArgs.agentPort === 'string') {
      config.port = parseInt(cliArgs.agentPort, 10);
    }
    
    if (cliArgs.clientPort && typeof cliArgs.clientPort === 'string') {
      config.clientPort = parseInt(cliArgs.clientPort, 10);
    }
    
    if (cliArgs.servicePort && typeof cliArgs.servicePort === 'string') {
      config.servicePort = parseInt(cliArgs.servicePort, 10);
    }
    
    if (cliArgs.logLevel && typeof cliArgs.logLevel === 'string') {
      config.logLevel = cliArgs.logLevel;
    }
    
    // Load configuration
    this.configLoader = new ConfigLoader({
      configPath: config.configPath
    });
    
    // Load and merge configurations
    const loadedConfig = this.configLoader.mergeWithOptions(config);
    const orchestratorSettings = this.configLoader.getOrchestratorSettings();
    
    this.port = config.port || orchestratorSettings.agentPort || Number(process.env.PORT) || 3000;
    this.clientPort = config.clientPort || orchestratorSettings.clientPort || Number(process.env.CLIENT_PORT) || 3001;
    this.servicePort = config.servicePort || orchestratorSettings.servicePort || Number(process.env.SERVICE_PORT) || 3002;
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

  private setupEventListeners(): void {
    // Listen for task created events
    this.eventBus.on('task.created', (taskId: string, agentId: string, clientId: string, taskData: any) => {
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
    this.eventBus.on('service.task.created', (taskId: string, serviceId: string, agentId: string, clientId: string, taskData: any) => {
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
    this.eventBus.on('agent.request', (taskId: string, targetAgentId: string, requestingAgentId: string, taskMessage: any) => {
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
    this.eventBus.on('agent.register', (message: any, connectionId: string, callback: Function) => {
      try {
        const result = this.messageHandler.handleAgentRegistration(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle service registration
    this.eventBus.on('service.register', (message: any, connectionId: string, callback: Function) => {
      try {
        const result = this.messageHandler.handleServiceRegistration(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Handle response messages
    this.eventBus.on('response.message', (message: any) => {
      if (message && message.requestId) {
        this.handleResponseMessage(message);
      }
    });
    
    // Handle task result forwarding to client
    this.eventBus.on('task.result', (clientId: string, taskId: string, content: any) => {
      this.forwardTaskResultToClient(clientId, taskId, content);
    });
    
    // Handle service task result forwarding to agent
    this.eventBus.on('service.task.result', (agentId: string, taskId: string, content: any) => {
      this.forwardServiceTaskResultToAgent(agentId, taskId, content);
    });
    
    // Handle task notifications
    this.eventBus.on('task.notification', (message: any) => {
      this.forwardTaskNotificationToClient(message);
    });
    
    // Handle service notifications
    this.eventBus.on('service.notification', (message: any) => {
      if (message.content && message.content.metadata) {
        const { clientId, agentId } = message.content.metadata;
        
        // Forward to client if clientId is available
        if (clientId) {
          this.forwardServiceTaskNotificationToClient(message);
        }
        
        // Forward to agent if agentId is available
        if (agentId) {
          this.forwardServiceTaskNotificationToAgent(agentId, message);
        }
      }
    });
  }

  /**
   * Start the orchestrator and all its servers
   */
  async start(): Promise<void> {
    try {
      console.log(`Starting Agent Swarm Protocol Orchestrator (${this.logLevel} mode)`);
      
      // Start the WebSocket servers
      await this.agentServer.start();
      console.log(`Agent server started on port ${this.port}`);
      
      await this.clientServer.start();
      console.log(`Client server started on port ${this.clientPort}`);
      
      await this.serviceServer.start();
      console.log(`Service server started on port ${this.servicePort}`);
      
      // Initialize components from config if available
      await this.initMCPServersFromConfig();
      await this.initAgentsFromConfig();
      await this.initServicesFromConfig();
      
      console.log('Orchestrator ready!');
    } catch (error) {
      console.error('Failed to start orchestrator:', error);
      throw error;
    }
  }

  /**
   * Initialize MCP servers from configuration
   */
  private async initMCPServersFromConfig(): Promise<void> {
    const mcpServers = this.configLoader.getMCPServers();
    
    if (mcpServers && mcpServers.length > 0) {
      for (const serverConfig of mcpServers) {
        try {
          this.mcp.registerServer({
            id: serverConfig.id || uuidv4(),
            name: serverConfig.name,
            type: serverConfig.type,
            capabilities: serverConfig.capabilities || [],
            status: 'online',
            path: serverConfig.path
          });
          
          console.log(`Registered MCP server: ${serverConfig.name}`);
        } catch (error) {
          console.error(`Failed to register MCP server ${serverConfig.name}:`, error);
        }
      }
    }
  }

  /**
   * Initialize agents from configuration
   */
  private async initAgentsFromConfig(): Promise<void> {
    const agentConfigs = this.configLoader.getAgentConfigurations();
    
    if (agentConfigs && Object.keys(agentConfigs).length > 0) {
      console.log(`Loaded ${Object.keys(agentConfigs).length} agent configurations`);
      
      for (const [agentName, config] of Object.entries(agentConfigs)) {
        // This just preloads the configurations, agents still need to connect
        this.agents.addAgentConfiguration(agentName, config);
      }
    }
  }

  /**
   * Initialize services from configuration
   */
  private async initServicesFromConfig(): Promise<void> {
    const serviceConfigs = this.configLoader.getServiceConfigurations();
    
    if (serviceConfigs && Object.keys(serviceConfigs).length > 0) {
      console.log(`Loaded ${Object.keys(serviceConfigs).length} service configurations`);
      
      for (const [serviceName, config] of Object.entries(serviceConfigs)) {
        // This just preloads the configurations, services still need to connect
        this.services.addServiceConfiguration(serviceName, config);
      }
    }
  }

  /**
   * Send a message to a WebSocket connection and wait for a response
   */
  async sendAndWaitForResponse(ws: WebSocketWithId, message: any, options: SendOptions = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = message.id || uuidv4();
      
      // Ensure message has an ID
      if (!message.id) {
        message.id = messageId;
      }
      
      // Convert message to string
      const messageString = JSON.stringify(message);
      
      // Set up timeout for response
      const timeout = options.timeout || 30000; // Default 30 seconds timeout
      const timer = setTimeout(() => {
        if (this.pendingResponses[messageId]) {
          delete this.pendingResponses[messageId];
          reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
        }
      }, timeout);
      
      // Store the handlers
      this.pendingResponses[messageId] = {
        resolve,
        reject,
        timer
      };
      
      // Send the message
      try {
        ws.send(messageString, (error) => {
          if (error) {
            clearTimeout(timer);
            delete this.pendingResponses[messageId];
            reject(error);
          }
        });
      } catch (error) {
        clearTimeout(timer);
        delete this.pendingResponses[messageId];
        reject(error);
      }
    });
  }

  /**
   * Handle response messages for outstanding requests
   */
  private handleResponseMessage(message: any): void {
    const requestId = message.requestId;
    
    if (requestId && this.pendingResponses[requestId]) {
      const { resolve, timer } = this.pendingResponses[requestId];
      
      // Clear the timeout and delete the pending response
      clearTimeout(timer);
      delete this.pendingResponses[requestId];
      
      // Resolve the promise with the response message
      resolve(message);
    }
  }

  /**
   * Forward task result to client
   */
  private forwardTaskResultToClient(clientId: string, taskId: string, content: any): void {
    this.clientServer.sendMessageToClient(clientId, {
      id: uuidv4(),
      type: 'task.result',
      taskId,
      content
    });
  }

  /**
   * Forward service task result to agent
   */
  private forwardServiceTaskResultToAgent(agentId: string, taskId: string, content: any): void {
    const agent = this.agents.getAgentById(agentId);
    
    if (agent && agent.connection) {
      agent.connection.send(JSON.stringify({
        id: uuidv4(),
        type: 'service.task.result',
        taskId,
        content
      }));
    } else {
      console.error(`Cannot forward service task result to agent ${agentId}: Agent not connected`);
    }
  }

  /**
   * Forward task error to client
   */
  private forwardTaskErrorToClient(clientId: string, message: any): void {
    this.clientServer.sendMessageToClient(clientId, message);
  }

  /**
   * Forward task notification to client
   */
  private forwardTaskNotificationToClient(message: any): void {
    // Extract clientId from metadata or look up in task registry
    let clientId = null;
    
    if (message.content && message.content.metadata && message.content.metadata.clientId) {
      // Get clientId directly from message metadata
      clientId = message.content.metadata.clientId;
    } else if (message.taskId) {
      // Look up task to find the clientId
      try {
        const task = this.tasks.getTask(message.taskId);
        if (task && task.clientId) {
          clientId = task.clientId;
        }
      } catch (error) {
        console.error(`Error looking up task for notification: ${error.message}`);
      }
    }
    
    if (clientId) {
      // Create notification message for client
      const notificationMessage = {
        id: uuidv4(),
        type: 'task.notification',
        taskId: message.taskId,
        content: message.content
      };
      
      // Send notification to client
      this.clientServer.sendMessageToClient(clientId, notificationMessage);
    } else {
      console.warn(`Cannot forward task notification: No clientId available`, message);
    }
  }

  /**
   * Forward service task notification to client
   */
  private forwardServiceTaskNotificationToClient(message: any): void {
    // Extract clientId from metadata or look up in task registry
    let clientId = null;
    
    if (message.content && message.content.metadata && message.content.metadata.clientId) {
      // Get clientId directly from message metadata
      clientId = message.content.metadata.clientId;
    } else if (message.taskId) {
      // Look up task to find the clientId
      try {
        const task = this.serviceTasks.getTask(message.taskId);
        if (task && task.clientId) {
          clientId = task.clientId;
        }
      } catch (error) {
        console.error(`Error looking up service task for notification: ${error.message}`);
      }
    }
    
    if (clientId) {
      // Create notification message for client
      const notificationMessage = {
        id: uuidv4(),
        type: 'service.notification',
        taskId: message.taskId,
        content: message.content
      };
      
      // Send notification to client
      this.clientServer.sendMessageToClient(clientId, notificationMessage);
    } else {
      console.warn(`Cannot forward service notification to client: No clientId available`, message);
    }
  }

  /**
   * Forward service task notification to agent
   */
  private forwardServiceTaskNotificationToAgent(agentId: string, message: any): void {
    const agent = this.agents.getAgentById(agentId);
    
    if (agent && agent.connection) {
      // Create notification message for agent
      const notificationMessage = {
        id: uuidv4(),
        type: 'service.notification',
        taskId: message.taskId,
        content: message.content
      };
      
      // Send notification to agent
      agent.connection.send(JSON.stringify(notificationMessage));
    } else {
      console.warn(`Cannot forward service notification to agent ${agentId}: Agent not connected`);
    }
  }

  /**
   * Stop the orchestrator and all its servers
   */
  async stop(): Promise<void> {
    try {
      console.log('Stopping Orchestrator...');
      
      // Close all pending responses
      for (const [messageId, pendingResponse] of Object.entries(this.pendingResponses)) {
        clearTimeout(pendingResponse.timer);
        pendingResponse.reject(new Error('Orchestrator is shutting down'));
        delete this.pendingResponses[messageId];
      }
      
      // Stop all servers
      await this.agentServer.stop();
      await this.clientServer.stop();
      await this.serviceServer.stop();
      
      console.log('Orchestrator stopped.');
    } catch (error) {
      console.error('Error stopping orchestrator:', error);
      throw error;
    }
  }
}

// Create orchestrator instance
const orchestrator = new Orchestrator();

// Start the orchestrator when run directly
if (require.main === module) {
  orchestrator.start()
    .catch(error => {
      console.error('Failed to start orchestrator:', error);
      process.exit(1);
    });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully');
    try {
      await orchestrator.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully');
    try {
      await orchestrator.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}

// Export the orchestrator class and instance
export { Orchestrator };
export default orchestrator; 