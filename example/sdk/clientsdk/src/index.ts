import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { ClientMessages } from '@agentswarmprotocol/types/messages';

import { WebSocketClient, WebSocketClientConfig } from './WebSocketClient';
import { MessageHandler } from './MessageHandler';
import { TaskManager, TaskRequestOptions } from './TaskManager';
import { AgentManager, AgentFilters } from './AgentManager';
import { MCPManager, MCPServerFilters } from './MCPManager';

/**
 * Configuration options for the SDK
 */
export interface SwarmClientSDKConfig extends WebSocketClientConfig {
  /** Default timeout for requests in milliseconds */
  defaultTimeout?: number;
}

/**
 * SwarmClientSDK - Client SDK for Agent Swarm Protocol
 * Handles client-side communication with the orchestrator
 */
export class SwarmClientSDK extends EventEmitter {
  private wsClient: WebSocketClient;
  private messageHandler: MessageHandler;
  private defaultTimeout: number;
  private clientId: string | null = null;
  
  private agentManager: AgentManager;
  private taskManager: TaskManager;
  private mcpManager: MCPManager;

  /**
   * Create a new SwarmClientSDK instance
   * @param config - Configuration options
   */
  constructor(config: SwarmClientSDKConfig = {}) {
    super();
    
    this.defaultTimeout = config.defaultTimeout || 30000;
    
    // Initialize WebSocket client
    this.wsClient = new WebSocketClient(config);
    
    // Initialize message handler
    this.messageHandler = new MessageHandler();
    
    // Initialize managers
    this.taskManager = new TaskManager(this.sendRequest.bind(this));
    this.agentManager = new AgentManager(this.sendRequest.bind(this));
    this.mcpManager = new MCPManager(this.sendRequest.bind(this));
    
    // Set up event forwarding
    this.wsClient.on('message', async (message: any) => {
      await this.messageHandler.handleMessage(message);
    });
    
    this.wsClient.on('connected', () => {
      this.emit('connected');
    });
    
    this.wsClient.on('disconnected', () => {
      this.emit('disconnected');
    });
    
    this.wsClient.on('error', (error: Error) => {
      this.emit('error', error);
    });
    
    // Forward events from message handler
    this.messageHandler.on('welcome', (content: any) => {
      if (content.clientId) {
        this.clientId = content.clientId;
        this.wsClient.setClientId(content.clientId);
      }
      this.emit('welcome', content);
    });
    
    // Set up event forwarding for task manager
    this.taskManager.registerEventListeners(this.messageHandler);
    this.taskManager.on('task-created', (data) => this.emit('task-created', data));
    this.taskManager.on('task-status', (data) => this.emit('task-status', data));
    this.taskManager.on('task-result', (data) => this.emit('task-result', data));
    this.taskManager.on('task-notification', (data) => this.emit('task-notification', data));
    
    // Set up event forwarding for agent manager
    this.agentManager.registerEventListeners(this.messageHandler);
    this.agentManager.on('agent-list', (data) => this.emit('agent-list', data));
    
    // Set up event forwarding for MCP manager
    this.mcpManager.registerEventListeners(this.messageHandler);
    this.mcpManager.on('mcp-server-list', (data) => this.emit('mcp-server-list', data));
    this.mcpManager.on('mcp-tool-executed', (data) => this.emit('mcp-tool-executed', data));
    
    // Forward remaining events
    this.messageHandler.on('orchestrator-error', (error: any) => {
      this.emit('orchestrator-error', error);
    });
  }

  /**
   * Connect to the orchestrator
   * @returns Promise that resolves when connected
   */
  async connect(): Promise<void> {
    return this.wsClient.connect();
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): void {
    this.wsClient.disconnect();
    this.messageHandler.clearPendingResponses();
  }

  /**
   * Check if connected to the orchestrator
   * @returns Whether the client is connected
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Get the client ID
   * @returns The client ID or null if not connected
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Send a request to the orchestrator
   * @param message - The message to send
   * @param options - Additional options
   * @returns The response message
   */
  async sendRequest(message: Partial<BaseMessage>, options: { timeout?: number } = {}): Promise<any> {
    // Set message ID if not set
    if (!message.id) {
      message.id = uuidv4();
    }
    
    // Set timestamp if not set
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Wait for response
    return this.messageHandler.waitForResponse(
      message,
      (msg: any) => this.wsClient.send(msg),
      { timeout: options.timeout || this.defaultTimeout }
    );
  }

  /**
   * Send a task to an agent
   * @param agentName - Name of the agent to send the task to
   * @param taskData - Task data to send
   * @param options - Additional options
   * @returns Task information
   */
  async sendTask(agentName: string, taskData: any, options: TaskRequestOptions = {}): Promise<any> {
    return this.taskManager.sendTask(agentName, taskData, options);
  }

  /**
   * Get the status of a task
   * @param taskId - ID of the task to get status for
   * @returns Task status
   */
  async getTaskStatus(taskId: string): Promise<any> {
    return this.taskManager.getTaskStatus(taskId);
  }

  /**
   * Get a list of all registered agents
   * @param filters - Optional filters to apply to the agent list
   * @returns Array of agent objects
   */
  async getAgentsList(filters: AgentFilters = {}): Promise<any[]> {
    return this.agentManager.getAgentsList(filters);
  }

  /**
   * List available MCP servers
   * @param filters - Optional filters
   * @returns List of MCP servers
   */
  async listMCPServers(filters: MCPServerFilters = {}): Promise<any[]> {
    return this.mcpManager.listMCPServers(filters);
  }

  /**
   * Get tools available on an MCP server
   * @param serverId - ID of the server to get tools for
   * @returns List of tools
   */
  async getMCPServerTools(serverId: string): Promise<any[]> {
    return this.mcpManager.getMCPServerTools(serverId);
  }

} 