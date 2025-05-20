import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { AgentRegistry } from '../registry/agent-registry';
import { AgentTaskRegistry } from './utils/tasks/agent-task-registry';
import { ServiceRegistry } from '../registry/service-registry';
import { ClientRegistry } from '../registry/client-registry';
import { ServiceTaskRegistry } from './utils/tasks/service-task-registry';
import AgentServer from '../agent/agent-server';
import ClientServer from '../client/client-server';
import ServiceServer from '../service/service-server';
import MessageHandler from './message-handler';
import * as mcp from './utils/mcp';
import ConfigLoader from './utils/config-loader';
import dotenv from 'dotenv';
import {
  OrchestratorConfig,
  PendingResponse,
  WebSocketWithId,
  SendOptions,
  TaskStatus
} from '@agentswarmprotocol/types/dist/common';

// Load environment variables
dotenv.config({ path: '../.env' });

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
  private tasks: AgentTaskRegistry;
  private services: ServiceRegistry;
  private clients: ClientRegistry;
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
    // Create config loader and get resolved config
    this.configLoader = new ConfigLoader({
      configPath: config.configPath
    });
    
    // Get the fully resolved configuration
    const resolvedConfig = this.configLoader.getResolvedConfig(config);
    
    // Set instance properties from resolved config
    this.port = resolvedConfig.port;
    this.clientPort = resolvedConfig.clientPort;
    this.servicePort = resolvedConfig.servicePort;
    this.logLevel = resolvedConfig.logLevel;
    
    this.agents = new AgentRegistry();
    this.tasks = new AgentTaskRegistry();
    this.services = new ServiceRegistry();
    this.clients = new ClientRegistry();
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
      clients: this.clients,
      eventBus: this.eventBus,
      mcp: this.mcp
    });
    
    // Create servers with specific dependencies rather than passing the entire orchestrator
    this.agentServer = new AgentServer(
      { agents: this.agents }, 
      this.eventBus, 
      { port: this.port },
      this.messageHandler
    );
    
    this.clientServer = new ClientServer(
      this.eventBus, 
      { 
        clientPort: this.clientPort,
        clientRegistry: this.clients
      }
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
      const connection = this.agents.getConnectionByAgentId(agentId);
      if (!connection) {
        console.error(`Cannot send task ${taskId} to agent ${agentId}: Agent connection not found`);
        this.tasks.updateTaskStatus(taskId, 'failed', { 
          error: 'Agent connection not found',
          metadata: {
            failedAt: new Date().toISOString()
          }
        });
        
        // Notify client if one is specified
        if (clientId) {
          this.clientServer.sendMessageToClient(clientId, {
            id: uuidv4(),
            type: 'task.error',
            content: {
              taskId,
              error: 'Agent connection not found',
              message: 'Cannot deliver task to agent: not connected'
            }
          });
        }
        return;
      }

      // Create a task message to send to the agent
      const taskMessage = {
        id: taskId,
        type: 'task.execute',
        content: {
          taskId: taskId,
          type: taskData.taskType,
          data: taskData
        }
      };
      
      // Send the task to the agent
      try {
        connection.send(JSON.stringify({
          ...taskMessage,
          timestamp: Date.now().toString()
        }));
        console.log(`Task ${taskId} sent to agent ${agentId}`);
        
        // Update task status to in_progress
        this.tasks.updateTaskStatus(taskId, 'in_progress', {
          note: 'Task sent to agent',
          metadata: {
            sentAt: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error(`Error sending task to agent: ${error instanceof Error ? error.message : String(error)}`);
        this.tasks.updateTaskStatus(taskId, 'failed', { 
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            failedAt: new Date().toISOString()
          }
        });
        
        // Notify client
        if (clientId) {
          this.clientServer.sendMessageToClient(clientId, {
            id: uuidv4(),
            type: 'task.error',
            content: {
              taskId,
              error: 'Failed to send task to agent',
              message: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
    });
    
    // Handle client task creation
    this.eventBus.on('client.task.create', async (message: any, clientId: string, callback: Function) => {
      try {
        const result = await this.messageHandler.handleTaskCreation(message, clientId);
        
        // Store the callback to be called when task is completed
        const taskId = result.taskId;
        
        // Create a one-time event listener for this specific task's completion
        const taskCompletionHandler = (statusMessage: any) => {
          if (statusMessage.content && 
              statusMessage.content.taskId === taskId && 
              statusMessage.content.status === 'completed') {
                
            // Check if this has a result to verify it's the final completion
            const hasTaskResult = statusMessage.content.result && 
                             (typeof statusMessage.content.result === 'object' || 
                              typeof statusMessage.content.result === 'string');
            
            // Only treat it as complete if it has a result
            if (hasTaskResult) {
              // Call the callback with the result and remove this listener
              callback({
                ...result,
                status: 'completed',
                result: statusMessage.content.result
              });
              this.eventBus.removeListener('task.status', taskCompletionHandler);
            }
          }
        };
        
        // Add listener for task.status events
        this.eventBus.on('task.status', taskCompletionHandler);
        
        // Notify the client that the task was created, but don't resolve the callback yet
        this.clientServer.sendMessageToClient(clientId, {
          id: uuidv4(),
          type: 'task.created',
          content: result
        });
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Listen for task status update events
    this.eventBus.on('task.status.received', (message: any) => {
      try {
        const { taskId, status, agentId } = message.content;
        console.log(`Processing task status update: ${taskId} status: ${status}`);
        
        if (taskId && status) {
          // Update task status in the registry
          this.tasks.updateTaskStatus(taskId, status, message.content);
          
          // Emit general task status event
          this.eventBus.emit('task.status', message);
          
          // Get the task information
          const task = this.tasks.getTask(taskId);
          
          if (task && task.clientId && typeof task.clientId === 'string') {
            // For in_progress status, only forward the status update without marking as completed
            if (status === 'in_progress') {
              console.log(`Forwarding in-progress status update to client: ${task.clientId}`);
              
              this.clientServer.sendMessageToClient(task.clientId, {
                id: uuidv4(),
                type: 'task.status',
                content: {
                  taskId,
                  status,
                  agentId,
                  timestamp: Date.now().toString()
                }
              });
            } 
            // For completed status, verify this is a real completion (not just an in-progress update with result)
            else if (status === 'completed') {
              console.log(`Forwarding completion status update to client: ${task.clientId}`);
              
              // Check if this message contains a task.result property to verify it's the final completion
              // This helps filter out intermediate result updates that should not be treated as completion
              const hasTaskResult = message.content.result && 
                                   (typeof message.content.result === 'object' || 
                                    typeof message.content.result === 'string');
              
              // Send the status update
              this.clientServer.sendMessageToClient(task.clientId, {
                id: uuidv4(),
                type: 'task.status',
                content: {
                  taskId,
                  status,
                  agentId,
                  result: hasTaskResult ? message.content.result : null,
                  timestamp: Date.now().toString()
                }
              });
              
              // Only send task.result message if we have a result and this appears to be the final completion
              if (hasTaskResult) {
                console.log(`Sending task.result for completed task ${taskId} to client ${task.clientId}`);
                this.clientServer.sendMessageToClient(task.clientId, {
                  id: uuidv4(),
                  type: 'task.result',
                  content: {
                    taskId,
                    status: 'completed',
                    result: message.content.result,
                    completedAt: new Date().toISOString()
                  }
                });
              }
            }
            // For failed status, forward as is
            else if (status === 'failed') {
              console.log(`Forwarding failed status update to client: ${task.clientId}`);
              
              this.clientServer.sendMessageToClient(task.clientId, {
                id: uuidv4(),
                type: 'task.status',
                content: {
                  taskId,
                  status,
                  agentId,
                  error: message.content.error,
                  timestamp: Date.now().toString()
                }
              });
            }
          } else if (task && task.clientId) {
            console.warn(`Invalid client ID for task ${taskId}: ${typeof task.clientId}`);
          }
        }
      } catch (error) {
        console.error(`Error handling task status update:`, error);
      }
    });
    
    // Listen for service task created events
    this.eventBus.on('service.task.created', (taskId: string, serviceId: string, agentId: string, clientId: string, taskData: any) => {
      console.log(`Service task ${taskId} created for service ${serviceId} by agent ${agentId}`);
      
      // Get the service connection
      const service = this.services.getServiceById(serviceId);
      if (service && service.connectionId) {
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
        this.sendAndWaitForResponse(service.connectionId, taskMessage)
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
      if (targetAgent && targetAgent.connectionId) {
        // Send the task to the target agent
        this.sendAndWaitForResponse(targetAgent.connectionId, taskMessage)
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
    
    // Listen for service.task.execute events
    this.eventBus.on('service.task.execute', async (message: any, connectionId: string, callback: Function) => {
      try {
        const result = await this.messageHandler.handleServiceTaskExecuteRequest(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Handle service registration
    this.eventBus.on('service.register', async (message: any, connectionId: string, callback: Function) => {
      try {
        const result = this.messageHandler.handleServiceRegistration(message, connectionId);
        callback(result);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
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

    // Handle client agent list requests
    this.eventBus.on('client.agent.list', (filters: any, callback: Function) => {
      try {
        const agents = this.messageHandler.getAgentList(filters);
        callback(agents);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Handle client service list requests
    this.eventBus.on('client.service.list', (filters: any, callback: Function) => {
      try {
        const services = this.services.getAllServices(filters);
        callback(services);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Handle agent list requests from agents
    this.eventBus.on('agent.list.request', (filters: any, callback: Function) => {
      try {
        const agents = this.messageHandler.getAgentList(filters);
        callback(agents);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Handle MCP servers list requests
    this.eventBus.on('mcp.servers.list.request', (filters: any, callback: Function) => {
      try {
        const servers = this.mcp.getServerList(filters);
        callback(servers);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Handle MCP tools list requests
    this.eventBus.on('mcp.tools.list.request', (serverId: string, callback: Function) => {
      try {
        if (!serverId) {
          callback({ error: 'Server ID is required' });
          return;
        }
        
        const tools = this.mcp.getToolList(serverId);
        callback(tools);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Handle MCP tool execution requests
    this.eventBus.on('mcp.tool.execute.request', (params: any, callback: Function) => {
      try {
        const { serverId, toolName, parameters, agentId } = params;
        
        if (!serverId || !toolName) {
          callback({ error: 'Server ID and tool name are required' });
          return;
        }
        
        // Execute the tool
        this.mcp.executeServerTool(serverId, toolName, parameters || {})
          .then((result: any) => {
            callback({
              serverId,
              toolName,
              status: 'success',
              result
            });
          })
          .catch((error: Error) => {
            callback({
              serverId,
              toolName,
              status: 'error',
              error: error.message
            });
          });
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Handle agent status update requests
    this.eventBus.on('agent.status.update', (message: any, connectionId: string, callback: Function) => {
      try {
        const agent = this.agents.getAgentByConnectionId(connectionId);
        if (!agent) {
          callback({ error: 'Agent not registered or unknown' });
          return;
        }
        
        const { status, message: statusMessage } = message.content;
        if (!status) {
          callback({ error: 'Status is required for status update' });
          return;
        }
        
        // Update agent status in the registry
        this.agents.updateAgentStatus(agent.id, status, {
          message: statusMessage,
          updatedAt: new Date().toISOString()
        });
        
        // Notify about success
        callback({
          agentId: agent.id,
          status,
          message: `Agent status updated to ${status}`
        });
        
        // Emit an event about the status change
        this.eventBus.emit('agent.status.changed', agent.id, status, statusMessage);
        
        console.log(`Agent ${agent.name} (${agent.id}) status updated to ${status}`);
      } catch (error) {
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Handle client messages to agents
    this.eventBus.on('client.message.agent', async (message: any, targetAgentId: string, callback: Function) => {
      try {
        // Create a task for the agent
        const taskId = uuidv4();
        const conversationId = uuidv4(); // Generate a conversation ID if not provided
        
        const taskData = {
          taskType: 'conversation:message',
          conversationId,
          message: message.content.text,
          role: message.content.role || 'user',
          context: {
            messageHistory: [],
            metadata: {
              clientId: message.content.sender.id,
              timestamp: message.timestamp || new Date().toISOString()
            }
          }
        };

        // Register task in task registry
        this.tasks.registerTask(taskId, {
          type: 'agent.task',
          name: 'Client Message',
          severity: 'normal',
          agentId: targetAgentId,
          clientId: message.content.sender.id,
          status: 'pending' as TaskStatus,
          createdAt: new Date().toISOString(),
          taskData
        });

        // Emit task created event
        this.eventBus.emit('task.created', taskId, targetAgentId, message.content.sender.id, taskData);

        callback({
          taskId,
          status: 'pending'
        });
      } catch (error) {
        console.error('Error handling client message:', error);
        callback({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Handle task status updates
    this.eventBus.on('task.status', (message: any) => {
      try {
        if (!message || !message.content) {
          console.error('Invalid task status message received:', message);
          return;
        }
        
        const { taskId, status } = message.content;
        if (!taskId || !status) {
          console.error('Invalid task status message - missing taskId or status:', message);
          return;
        }
        
        console.log(`Received task status update for task ${taskId}: ${status}`);
        
        // Update task status in registry
        this.tasks.updateTaskStatus(taskId, status, message.content);
        
        // Only handle actual completions with results, not intermediate status messages
        if (status === 'completed') {
          // Check if this message contains a task.result property to verify it's the final completion
          const hasTaskResult = message.content.result && 
                               (typeof message.content.result === 'object' || 
                                typeof message.content.result === 'string');
          
          // Only process the completion if it has a result
          if (hasTaskResult) {
            // Get the task to retrieve the clientId
            try {
              const task = this.tasks.getTask(taskId);
              if (task && task.clientId && typeof task.clientId === 'string') {
                // Send standardized task.result message for completed tasks
                console.log(`Task ${taskId} completed - sending result to client ${task.clientId}`);
                this.clientServer.sendMessageToClient(task.clientId, {
                  id: uuidv4(),
                  type: 'task.result',
                  content: {
                    taskId,
                    status: 'completed',
                    result: message.content.result,
                    completedAt: new Date().toISOString()
                  }
                });
              } else if (task && task.clientId) {
                console.warn(`Task ${taskId} completed but has invalid clientId: ${typeof task.clientId}`);
              } else {
                console.warn(`Task ${taskId} completed but has no clientId`);
              }
            } catch (error) {
              console.error(`Error handling completed task ${taskId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error handling task status update:', error);
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
          // Include command and args from the config
          await this.mcp.registerMCPServer({
            id: serverConfig.id || uuidv4(),
            name: serverConfig.name,
            type: serverConfig.type || 'node',
            capabilities: serverConfig.capabilities || [],
            path: serverConfig.path,
            command: serverConfig.command,
            args: serverConfig.args,
            metadata: serverConfig.metadata || {}
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
        this.services.setServiceConfiguration(serviceName, config);
      }
    }
  }

  /**
   * Send a message to a WebSocket connection or to a connection ID and wait for a response
   * @param wsOrConnectionId - WebSocket object or connection ID
   * @param message - Message to send
   * @param options - Send options
   * @returns Promise resolving with the response
   */
  async sendAndWaitForResponse(
    wsOrConnectionId: WebSocketWithId | string, 
    message: any, 
    options: SendOptions = {}
  ): Promise<any> {
    const messageId = message.id || uuidv4();
    const timeout = options.timeout || 30000;
    
    // Ensure the message has an ID
    if (!message.id) {
      message.id = messageId;
    }
    
    // Create a promise that will be resolved with the response
    const responsePromise = new Promise((resolve, reject) => {
      // Set a timeout to reject the promise
      const timeoutId = setTimeout(() => {
        delete this.pendingResponses[messageId];
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);
      
      // Store the pending response information
      this.pendingResponses[messageId] = {
        resolve,
        reject,
        timer: timeoutId
      };
    });
    
    // Determine if we need to get a WebSocket from a connection ID
    let ws: WebSocketWithId;
    
    if (typeof wsOrConnectionId === 'string') {
      // Get the WebSocket from the connection ID
      const connection = this.agents.getConnection(wsOrConnectionId);
      
      if (!connection) {
        delete this.pendingResponses[messageId];
        throw new Error(`Connection with ID ${wsOrConnectionId} not found`);
      }
      
      ws = connection as WebSocketWithId;
    } else {
      // Use the provided WebSocket
      ws = wsOrConnectionId;
    }
    
    // Add timestamp to the message if not already present
    if (!message.timestamp) {
      message.timestamp = Date.now().toString();
    }
    
    // Send the message to the client
    ws.send(JSON.stringify(message));
    
    // Wait for the response
    return responsePromise;
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
    if (!clientId || typeof clientId !== 'string') {
      console.error(`Cannot forward task result: Invalid client ID [${clientId}]`);
      return;
    }
    
    try {
      // Format the message in a consistent way for the UI
      console.log(`Forwarding task result to client ${clientId} for task ${taskId}`);
      
      // Create a properly formatted task result message that matches TaskResultMessage interface
      const resultMessage = {
        id: uuidv4(),
        type: 'task.result',
        content: {
          taskId,
          status: 'completed',
          result: content.result || content,
          completedAt: new Date().toISOString()
        }
      };
      
      console.log(`Task result message: ${JSON.stringify(resultMessage)}`);
      this.clientServer.sendMessageToClient(clientId, resultMessage);
    } catch (error) {
      console.error(`Error forwarding task result to client ${clientId}:`, error);
    }
  }

  /**
   * Forward service task result to agent
   */
  private forwardServiceTaskResultToAgent(agentId: string, taskId: string, content: any): void {
    const agent = this.agents.getAgentById(agentId);
    
    if (agent && agent.connectionId && (agent as any).connection) {
      const connection = (agent as any).connection;
      try {
        connection.send(JSON.stringify({
          id: uuidv4(),
          type: 'service.task.result',
          taskId,
          content,
          timestamp: Date.now().toString()
        }));
      } catch (error) {
        console.error(`Error forwarding service task result to agent ${agentId}:`, error);
      }
    } else {
      console.error(`Cannot forward service task result to agent ${agentId}: Agent not connected or connection not available`);
    }
  }

  /**
   * Forward task error to client
   */
  private forwardTaskErrorToClient(clientId: string, message: any): void {
    if (!clientId || typeof clientId !== 'string') {
      console.error(`Cannot forward task error: Invalid client ID [${clientId}]`);
      return;
    }
    
    try {
      this.clientServer.sendMessageToClient(clientId, message);
    } catch (error) {
      console.error(`Error forwarding task error to client ${clientId}:`, error);
    }
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
        console.error(`Error looking up task for notification: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Check if clientId is valid
    if (!clientId || typeof clientId !== 'string') {
      console.warn(`Cannot forward task notification: Invalid clientId [${clientId}]`, message);
      return;
    }
    
    try {
      // Create notification message for client
      const notificationMessage = {
        id: uuidv4(),
        type: 'task.notification',
        taskId: message.taskId,
        content: message.content
      };
      
      // Send notification to client
      this.clientServer.sendMessageToClient(clientId, notificationMessage);
    } catch (error) {
      console.error(`Error forwarding notification to client ${clientId}:`, error);
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
        console.error(`Error looking up service task for notification: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Check if clientId is valid
    if (!clientId || typeof clientId !== 'string') {
      console.warn(`Cannot forward service notification to client: Invalid clientId [${clientId}]`, message);
      return;
    }
    
    try {
      // Create notification message for client
      const notificationMessage = {
        id: uuidv4(),
        type: 'service.notification',
        taskId: message.taskId,
        content: message.content
      };
      
      // Send notification to client
      this.clientServer.sendMessageToClient(clientId, notificationMessage);
    } catch (error) {
      console.error(`Error forwarding service notification to client ${clientId}:`, error);
    }
  }

  /**
   * Forward service task notification to agent
   */
  private forwardServiceTaskNotificationToAgent(agentId: string, message: any): void {
    const agent = this.agents.getAgentById(agentId);
    
    if (agent && agent.connectionId && (agent as any).connection) {
      const connection = (agent as any).connection;
      try {
        // Create notification message for agent
        const notificationMessage = {
          id: uuidv4(),
          type: 'service.notification',
          taskId: message.taskId,
          content: message.content,
          timestamp: Date.now().toString()
        };
        
        // Send notification to agent
        connection.send(JSON.stringify(notificationMessage));
      } catch (error) {
        console.warn(`Error forwarding service notification to agent ${agentId}:`, error);
      }
    } else {
      console.warn(`Cannot forward service notification to agent ${agentId}: Agent not connected or connection not available`);
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