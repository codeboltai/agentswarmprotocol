/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, AgentStatus } from '@agentswarmprotocol/types/common';
import { AgentConfig, MessageHandler, TaskHandler, TaskExecuteMessage } from './core/types';
import { WebSocketManager } from './core/WebSocketManager';
import { MessageHandler as MessageHandlerClass } from './handlers/MessageHandler';
import { TaskHandler as TaskHandlerClass } from './handlers/TaskHandler';
import { AgentManager } from './services/AgentManager';
import { ServiceManager } from './services/ServiceManager';
import { MCPManager } from './services/MCPManager';

class SwarmAgentSDK extends EventEmitter {
  // Core properties
  protected agentId: string;
  protected name: string;
  protected agentType: string;
  protected capabilities: string[];
  protected description: string;
  protected manifest: Record<string, any>;
  protected logger: Console;

  // Module instances
  private webSocketManager: WebSocketManager;
  private messageHandler: MessageHandlerClass;
  private taskHandler: TaskHandlerClass;
  private agentManager: AgentManager;
  private serviceManager: ServiceManager;
  private mcpManager: MCPManager;

  constructor(config: AgentConfig = {}) {
    super();
    
    // Initialize properties
    this.agentId = config.agentId || uuidv4();
    this.name = config.name || 'Generic Agent';
    this.agentType = config.agentType || 'generic';
    this.capabilities = config.capabilities || [];
    this.description = config.description || 'Generic Agent';
    this.manifest = config.manifest || {};
    this.logger = config.logger || console;
    
    // Initialize modules
    this.webSocketManager = new WebSocketManager(
      config.orchestratorUrl || 'ws://localhost:3000',
      config.autoReconnect !== false,
      config.reconnectInterval || 5000,
      this.logger
    );
    
    this.messageHandler = new MessageHandlerClass(this.webSocketManager, this.logger);
    this.taskHandler = new TaskHandlerClass(this.webSocketManager, this.agentId, this.logger);
    this.agentManager = new AgentManager(this.webSocketManager, this.agentId, this.logger);
    this.serviceManager = new ServiceManager(this.webSocketManager, this.logger);
    this.mcpManager = new MCPManager(this.webSocketManager, this.logger);
    
    // Set up event forwarding
    this.setupEventForwarding();
    
    // Handle special case for task.execute messages
    this.messageHandler.on('task.execute', (content, message) => {
      this.taskHandler.handleTask(message as TaskExecuteMessage);
    });
  }

  /**
   * Set up event forwarding from the modules to this SDK instance
   */
  private setupEventForwarding() {
    // Forward WebSocketManager events
    this.webSocketManager.on('connected', () => {
      // Register agent with orchestrator
      this.send({
        type: 'agent.register',
        content: {
          name: this.name,
          capabilities: this.capabilities,
          manifest: this.manifest
        }
      } as BaseMessage)
      .then(response => {
        // Store the assigned agent ID if provided
        if (response && response.content && response.content.agentId) {
          this.agentId = response.content.agentId;
        }
        this.emit('registered', response.content);
      })
      .catch(err => {
        this.emit('error', new Error(`Failed to register: ${err.message}`));
      });
      
      this.emit('connected');
    });
    
    this.webSocketManager.on('disconnected', () => this.emit('disconnected'));
    this.webSocketManager.on('error', (error) => this.emit('error', error));
    
    // Forward MessageHandler events
    this.messageHandler.on('welcome', (content) => this.emit('welcome', content));
    this.messageHandler.on('agent-request-accepted', (content) => this.emit('agent-request-accepted', content));
    this.messageHandler.on('agent-response', (content) => this.emit('agent-response', content));
    this.messageHandler.on('registered', (content) => this.emit('registered', content));
    this.messageHandler.on('service-response', (content) => this.emit('service-response', content));
    
    // Forward TaskHandler events
    this.taskHandler.on('task', (taskData, message) => this.emit('task', taskData, message));
  }

  /**
   * Connect to the orchestrator
   * @returns {Promise} Resolves when connected
   */
  connect(): Promise<SwarmAgentSDK> {
    return this.webSocketManager.connect().then(() => this);
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): SwarmAgentSDK {
    this.webSocketManager.disconnect();
    return this;
  }

  /**
   * Expose the handleMessage method (mainly for testing)
   * @param {BaseMessage} message The message to handle
   */
  handleMessage(message: BaseMessage): void {
    this.messageHandler.handleMessage(message);
  }

  /**
   * Register a message handler for a specific message type
   * @param messageType Type of message to handle
   * @param handler Handler function
   */
  onMessage(messageType: string, handler: MessageHandler): SwarmAgentSDK {
    this.messageHandler.onMessage(messageType, handler);
    return this;
  }

  /**
   * Send a message during task execution
   * @param taskId ID of the task being executed
   * @param content Message content
   */
  sendMessage(taskId: string, content: any): void {
    this.taskHandler.sendMessage(taskId, content);
  }

  /**
   * Register a task handler for a specific task type
   * @param taskType Type of task to handle
   * @param handler Handler function
   */
  registerTaskHandler(taskType: string, handler: TaskHandler): SwarmAgentSDK {
    this.taskHandler.registerTaskHandler(taskType, handler);
    return this;
  }

  /**
   * Register a default task handler for when no specific handler is found
   * @param handler Handler function
   */
  registerDefaultTaskHandler(handler: TaskHandler): SwarmAgentSDK {
    this.taskHandler.registerDefaultTaskHandler(handler);
    return this;
  }

  /**
   * Send a task result back to the orchestrator
   * @param taskId ID of the task
   * @param result Result data
   */
  sendTaskResult(taskId: string, result: any): void {
    this.taskHandler.sendTaskResult(taskId, result);
  }

  /**
   * Send a message to the orchestrator
   * @param message Message to send
   */
  send(message: BaseMessage): Promise<BaseMessage> {
    return this.webSocketManager.send(message);
  }

  /**
   * Send a message and wait for a response
   * @param message Message to send
   * @param timeout Timeout in milliseconds
   */
  sendAndWaitForResponse(message: BaseMessage, timeout = 30000): Promise<BaseMessage> {
    return this.webSocketManager.sendAndWaitForResponse(message, timeout);
  }

  // Agent Manager methods
  /**
   * Request another agent to perform a task
   * @param targetAgentName Name of the target agent
   * @param taskData Task data
   * @param timeout Request timeout
   */
  requestAgentTask(targetAgentName: string, taskData: any, timeout = 30000): Promise<any> {
    return this.agentManager.requestAgentTask(targetAgentName, taskData, timeout);
  }

  /**
   * Get list of agents
   * @param filters Filter criteria
   */
  getAgentList(filters: Record<string, any> = {}): Promise<any[]> {
    return this.agentManager.getAgentList(filters);
  }

  /**
   * Set agent status
   * @param status New status
   */
  setStatus(status: AgentStatus): Promise<void> {
    return this.agentManager.setStatus(status);
  }

  /**
   * Execute a task on another agent
   * @param targetAgentName Name of the target agent
   * @param taskType Type of task
   * @param taskData Task data
   * @param timeout Request timeout
   */
  executeAgentTask(
    targetAgentName: string, 
    taskType: string, 
    taskData: Record<string, any> = {}, 
    timeout = 30000
  ): Promise<any> {
    return this.agentManager.executeAgentTask(targetAgentName, taskType, taskData, timeout);
  }

  /**
   * Register a handler for agent requests
   * @param taskType Type of task to handle
   * @param handler Handler function
   */
  onAgentRequest(taskType: string, handler: TaskHandler): SwarmAgentSDK {
    this.registerTaskHandler(taskType, handler);
    return this;
  }

  // Service Manager methods
  /**
   * Request a service
   * @param serviceName Name of the service
   * @param params Service parameters
   * @param timeout Request timeout
   */
  requestService(serviceName: string, params: Record<string, any> = {}, timeout = 30000): Promise<any> {
    return this.serviceManager.requestService(serviceName, params, timeout);
  }

  /**
   * Convenience method for executing a service
   * @param serviceName Name of the service
   * @param params Parameters to pass
   * @param timeout Request timeout
   */
  executeService(serviceName: string, params: Record<string, any> = {}, timeout = 30000): Promise<any> {
    return this.serviceManager.executeService(serviceName, params, timeout);
  }

  /**
   * Execute a service task
   * @param serviceId Service ID or name
   * @param functionName Function name
   * @param params Parameters
   * @param options Additional options
   */
  executeServiceTask(
    serviceId: string,
    functionName: string,
    params: Record<string, any> = {},
    options = {
      timeout: 30000,
      onNotification: undefined as ((notification: any) => void) | undefined,
      clientId: undefined as string | undefined
    }
  ): Promise<any> {
    return this.serviceManager.executeServiceTask(serviceId, functionName, params, options);
  }

  /**
   * Get a list of available services
   * @param filters Filter criteria
   */
  getServiceList(filters: Record<string, any> = {}): Promise<any[]> {
    return this.serviceManager.getServiceList(filters);
  }

  // MCP Manager methods
  /**
   * Request MCP service
   * @param params Service parameters
   * @param timeout Request timeout
   * @deprecated Use getMCPServers, getMCPTools, and executeMCPTool instead
   */
  requestMCPService(params: Record<string, any> = {}, timeout = 30000): Promise<any> {
    return this.mcpManager.requestMCPService(params, timeout);
  }

  /**
   * Get list of MCP servers
   * @param filters Filter criteria
   * @param timeout Request timeout
   */
  getMCPServers(filters: Record<string, any> = {}, timeout = 30000): Promise<any[]> {
    return this.mcpManager.getMCPServers(filters, timeout);
  }

  /**
   * Get list of tools for an MCP server
   * @param serverId Server ID
   * @param timeout Request timeout
   */
  getMCPTools(serverId: string, timeout = 30000): Promise<any[]> {
    return this.mcpManager.getMCPTools(serverId, timeout);
  }

  /**
   * Execute an MCP tool
   * @param serverId Server ID
   * @param toolName Tool name
   * @param parameters Tool parameters
   * @param timeout Request timeout
   */
  executeMCPTool(
    serverId: string, 
    toolName: string, 
    parameters: Record<string, any> = {}, 
    timeout = 60000
  ): Promise<any> {
    return this.mcpManager.executeMCPTool(serverId, toolName, parameters, timeout);
  }

  /**
   * Execute a tool by name (will find server automatically)
   * @param toolName Tool name
   * @param parameters Tool parameters
   * @param serverId Optional server ID (if known)
   * @param timeout Request timeout
   */
  executeTool(
    toolName: string, 
    parameters: Record<string, any> = {}, 
    serverId: string | null = null, 
    timeout = 60000
  ): Promise<any> {
    return this.mcpManager.executeTool(toolName, parameters, serverId, timeout);
  }

  /**
   * Send a task notification
   * @param notification Notification data
   */
  sendTaskNotification(notification: any): Promise<void> {
    return this.taskHandler.sendTaskNotification(notification);
  }

  /**
   * Register a handler for notifications
   * @param handler Handler function
   */
  onNotification(handler: (notification: any) => void): SwarmAgentSDK {
    this.onMessage('task.notification', (content) => {
      handler(content);
    });
    
    return this;
  }
}

export { SwarmAgentSDK };
export default SwarmAgentSDK; 