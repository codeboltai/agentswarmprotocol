/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, AgentStatus } from '@agentswarmprotocol/types/common';
import { AgentConfig, MessageHandler, TaskHandler, TaskExecuteMessage } from './core/types';
import { WebSocketManager } from './core/WebSocketManager';
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
    
    this.taskHandler = new TaskHandlerClass(this.webSocketManager, this.agentId, this.logger);
    this.agentManager = new AgentManager(this.webSocketManager, this.agentId, this.logger);
    this.serviceManager = new ServiceManager(this.webSocketManager, this.logger);
    this.mcpManager = new MCPManager(this.webSocketManager, this.logger);
    
    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from the modules to this SDK instance
   */
  private setupEventForwarding() {
    // Forward WebSocketManager events
    this.webSocketManager.on('connected', () => {
      // Register agent with orchestrator
      this.sendRegistration()
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

    // Message routing logic (replaces InternalMessageHandler)
    this.webSocketManager.on('message', (message: BaseMessage) => {
      this.processMessage(message);
    });

    // Forward TaskHandler events
    this.taskHandler.on('task', (taskData, message) => this.emit('task', taskData, message));
  }

  /**
   * Send registration message to the orchestrator
   * @private
   */
  private sendRegistration(): Promise<BaseMessage> {
    return this.webSocketManager.send({
      type: 'agent.register',
      content: {
        id: this.agentId,
        agentId: this.agentId,
        name: this.name,
        capabilities: this.capabilities,
        manifest: {
          ...this.manifest,
          id: this.agentId
        }
      }
    } as BaseMessage);
  }

  /**
   * Process an incoming message and route it appropriately
   * @param {BaseMessage} message The message to process
   * @private
   */
  private processMessage(message: BaseMessage): void {
    this.emit('raw-message', message);

    // Check if this is a response to a pending request
    if (message.requestId && this.webSocketManager.getPendingResponses().has(message.requestId)) {
      const isError = message.type === 'error' || (message.content && message.content.error);
      this.webSocketManager.handleResponse(message.requestId, message, isError);
      return;
    }

    // Emit for the specific message type
    this.emit(message.type, message.content, message);

    // For standard message types
    switch (message.type) {
      case 'agent.registered':
        this.emit('registered', message.content);
        break;
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
      case 'task.execute':
        this.taskHandler.handleTask(message as TaskExecuteMessage);
        break;
      case 'task.messageresponse':
        this.emit('task.messageresponse', message.content);
        break;
      case 'childagent.request.accepted':
        this.emit('agent-request-accepted', message.content);
        break;
      case 'childagent.response':
        this.emit('childagent.response', message.content);
        break;
      case 'service.request.accepted':
        this.emit('service-request-accepted', message.content);
        break;
      case 'service.response':
        this.emit('service-response', message.content);
        break;
      case 'ping':
        this.sendPong(message.id);
        break;
      case 'error':
        this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
        break;
      case 'mcp.servers.list':
        try {
          // Handle different response formats
          const servers = message.content.servers || message.content;
          if (!Array.isArray(servers)) {
            this.logger.warn('Received mcp.servers.list without proper servers array', message.content);
            this.emit('mcp-servers-list', []);
          } else {
            this.emit('mcp-servers-list', servers);
          }
        } catch (error) {
          this.logger.error('Error handling mcp.servers.list message:', error);
          this.emit('mcp-servers-list', []);
        }
        break;
      case 'mcp.tools.list':
        try {
          // Handle different response formats
          const tools = message.content.tools || message.content;
          if (!Array.isArray(tools)) {
            this.logger.warn('Received mcp.tools.list without proper tools array', message.content);
            this.emit('mcp-tools-list', []);
          } else {
            this.emit('mcp-tools-list', tools);
          }
        } catch (error) {
          this.logger.error('Error handling mcp.tools.list message:', error);
          this.emit('mcp-tools-list', []);
        }
        break;
      case 'mcp.tool.execution.result':
        try {
          // Handle different response formats
          const result = message.content.result !== undefined ? message.content.result : message.content;
          this.emit('mcp-tool-execution-result', result);
        } catch (error) {
          this.logger.error('Error handling mcp.tool.execution.result message:', error);
          this.emit('mcp-tool-execution-result', null);
        }
        break;
      default:
        this.logger.debug(`Unhandled message type: ${message.type}`);
        break;
    }
  }

  /**
   * Send a pong response for the given messageId
   * @private
   */
  private sendPong(messageId: string): void {
    this.webSocketManager.send({ 
      type: 'pong', 
      id: messageId, 
      content: {} 
    } as BaseMessage);
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

  //Ok
  /**
   * Set agent status
   * @param status New status
   */
  setStatus(status: AgentStatus): Promise<void> {
    return this.agentManager.setStatus(status);
  }

  // System Level Messages between Agent And Orchestrator



  // Task Level Communication between Agent And Orchestrator

  /**
   * Register a handler for all tasks
   * @param handler Handler function
   */
  onTask(handler: TaskHandler): SwarmAgentSDK {
    this.taskHandler.onTask(handler);
    return this;
  }

  //Ok
  /**
   * Send a message during task execution
   * @param taskId ID of the task being executed
   * @param content Message content
   */
  sendTaskMessage(taskId: string, content: any): void {
    this.taskHandler.sendTaskMessage(taskId, content);
  }

  //OK
  /**
   * Send a task result back to the orchestrator
   * @param taskId ID of the task
   * @param result Result data
   */
  sendTaskResult(taskId: string, result: any): void {
    this.taskHandler.sendTaskResult(taskId, result);
  }

  //OK
  /**
   * Send a request message during task execution and wait for a response
   * @param taskId ID of the task being executed
   * @param content Request content
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with the response content
   */
  requestMessageDuringTask(taskId: string, content: any, timeout = 30000): Promise<any> {
    return this.taskHandler.requestMessageDuringTask(taskId, content, timeout);
  }

  // Child Agent Management through Orchestrator

  //OK
  /**
   * Get list of agents
   * @param filters Filter criteria
   */
  getAgentList(filters: Record<string, any> = {}): Promise<any[]> {
    return this.agentManager.getAgentList(filters);
  }

  //OK
  /**
   * Request another agent to perform a task
   * @param targetAgentName Name of the target agent
   * @param taskData Task data
   * @param timeout Request timeout
   */
  executeChildAgentTask(targetAgentName: string, taskData: any, timeout = 30000): Promise<any> {
    return this.agentManager.executeChildAgentTask(targetAgentName, taskData, timeout);
  }

  // Service Manager methods
  //OK  
  /**
   * Execute a service task
   * @param serviceId Service ID or name
   * @param functionName Function name
   * @param params Parameters
   * @param options Additional options
   */
  executeServiceTask(
    serviceId: string,
    toolName: string,
    params: Record<string, any> = {},
    options = {
      timeout: 30000,
      clientId: undefined as string | undefined
    }
  ): Promise<any> {
    // First verify we have the serviceId
    if (!serviceId) {
      this.logger.error('executeServiceTask called with empty serviceId');
      return Promise.reject(new Error('Service ID is required for executing a service task'));
    }
    
    this.logger.debug(`Executing service task "${toolName}" on service "${serviceId}"`);
    
    try {
      return this.serviceManager.executeServiceTask(serviceId, toolName, params, options)
        .catch(error => {
          // Enhance error messages for better troubleshooting
          if (error.message.includes('Connection not found')) {
            this.logger.error(`Service connection error: Unable to find service "${serviceId}". Make sure the service is running and connected.`);
            throw new Error(`Service "${serviceId}" is not connected or does not exist. Please verify the service is running and properly registered.`);
          }
          
          // Handle other common errors
          if (error.message.includes('timed out')) {
            this.logger.error(`Service task timed out: "${toolName}" on service "${serviceId}"`);
            throw new Error(`Service task "${toolName}" timed out after ${options.timeout}ms. The service might be unresponsive.`);
          }
          
          // Pass through other errors
          throw error;
        });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to execute service task: ${errorMessage}`);
      return Promise.reject(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  //OK
  /**
   * Get a list of available services
   * @param filters Filter criteria
   */
  getServiceList(filters: Record<string, any> = {}): Promise<any[]> {
    return this.serviceManager.getServiceList(filters);
  }

  //Ok
  /**
   * Get a list of tools for a specific service
   * @param serviceId Service ID or name
   * @param options Optional parameters (e.g., timeout)
   */
  getServiceToolList(serviceId: string, options: { timeout?: number } = {}): Promise<any[]> {
    return this.serviceManager.getServiceToolList(serviceId, options);
  }

 
  // MCP Manager methods
  //OK
  /**
   * Get list of MCP servers
   * @param filters Filter criteria
   * @param timeout Request timeout
   */
  getMCPServers(filters: Record<string, any> = {}, timeout = 30000): Promise<any[]> {
    return this.mcpManager.getMCPServers(filters, timeout);
  }

  //OK
  /**
   * Get list of tools for an MCP server
   * @param serverId Server ID
   * @param timeout Request timeout
   */
  getMCPTools(serverId: string, timeout = 30000): Promise<any[]> {
    return this.mcpManager.getMCPTools(serverId, timeout);
  }

  //OK
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
  
}

export { SwarmAgentSDK };
export default SwarmAgentSDK; 