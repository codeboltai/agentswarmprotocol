import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { ClientMessages } from '@agentswarmprotocol/types/messages';

import { WebSocketClient, WebSocketClientConfig } from './WebSocketClient';
import { MessageHandler } from './MessageHandler';
import { TaskManager } from './TaskManager';
import { AgentManager } from './AgentManager';
import { MCPManager } from './MCPManager';

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
  
  public agents: AgentManager;
  public tasks: TaskManager;
  public mcp: MCPManager;

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
    this.tasks = new TaskManager(this.sendRequest.bind(this));
    this.agents = new AgentManager(this.sendRequest.bind(this));
    this.mcp = new MCPManager(this.sendRequest.bind(this));
    
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
    this.tasks.registerEventListeners(this.messageHandler);
    
    // Set up event forwarding for agent manager
    this.agents.registerEventListeners(this.messageHandler);
    
    // Set up event forwarding for MCP manager
    this.mcp.registerEventListeners(this.messageHandler);
    
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
  async sendTask(agentName: string, taskData: any, options: any = {}): Promise<any> {
    return this.tasks.sendTask(agentName, taskData, options);
  }

  /**
   * Get a list of all registered agents
   * @param filters - Optional filters to apply to the agent list
   * @returns Array of agent objects
   */
  async getAgents(filters = {}): Promise<any[]> {
    return this.agents.getAgents(filters);
  }

  /**
   * List available MCP servers
   * @param filters - Optional filters
   * @returns List of MCP servers
   */
  async listMCPServers(filters = {}): Promise<any[]> {
    return this.mcp.listMCPServers(filters);
  }
}

export { WebSocketClient, MessageHandler, TaskManager, AgentManager, MCPManager };
export * from './WebSocketClient';
export * from './MessageHandler';
export * from './TaskManager';
export * from './AgentManager';
export * from './MCPManager'; 