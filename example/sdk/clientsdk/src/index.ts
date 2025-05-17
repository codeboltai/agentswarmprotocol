import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketClientConfig } from '@agentswarmprotocol/types/sdk/clientsdk';

import { WebSocketClient } from './service/WebSocketClient';
import { TaskManager } from './manager/TaskManager';
import { AgentManager } from './manager/AgentManager';
import { MCPManager, MCPServerFilters } from './manager/MCPManager';
import { AgentFilters, TaskRequestOptions } from './types';

/**
 * SwarmClientSDK - Client SDK for Agent Swarm Protocol
 * Handles client-side communication with the orchestrator
 */
export class SwarmClientSDK extends EventEmitter {
  private wsClient: WebSocketClient;
  private clientId: string | null = null;
  
  private agentManager: AgentManager;
  private taskManager: TaskManager;
  private mcpManager: MCPManager;
  


  /**
   * Create a new SwarmClientSDK instance
   * @param config - Configuration options
   */
  constructor(config: WebSocketClientConfig = {}) {
    super();
    
    // Initialize WebSocket client
    this.wsClient = new WebSocketClient(config);
    
    // Initialize managers with the WebSocketClient
    this.agentManager = new AgentManager(this.wsClient);
    this.mcpManager = new MCPManager(this.wsClient);
    // Pass this instance to TaskManager for event listening
    this.taskManager = new TaskManager(this.wsClient, this);
    
    // Set up event forwarding
    this.wsClient.on('connected', () => {
      this.emit('connected');
    });
    
    this.wsClient.on('disconnected', () => {
      this.emit('disconnected');
    });
    
    this.wsClient.on('error', (error: Error) => {
      this.emit('error', error);
    });
    
    // Set up central message handling
    this.wsClient.on('message', this.handleMessage.bind(this));
  }

  /**
   * Handle incoming messages from the orchestrator
   * @param message - The received message
   */
  private handleMessage(message: any): void {
    console.log(`SwarmClientSDK received message: ${JSON.stringify(message)}`);
    
    // Emit the raw message for anyone who wants to listen
    this.emit('raw-message', message);
    
    // Handle specific message types
    switch (message.type) {
      case 'orchestrator.welcome':
        if (message.content && message.content.clientId) {
          this.clientId = message.content.clientId;
        }
        this.emit('welcome', message.content);
        break;
        
      case 'agent.list':
        this.emit('agent-list', message.content.agents);
        break;
        
      case 'mcp.server.list':
        this.emit('mcp-server-list', message.content.servers);
        break;
        
      case 'task.result':
     
        
        // Emit the event for others to listen
        this.emit('task-result', message.content);
        break;
        
      case 'task.status':
       
        this.emit('task-status', message.content);
    
        break;
        
      case 'task.created':
        this.emit('task-created', message.content);
        break;
        
      case 'task.notification':
        this.emit('task-notification', message.content);
        break;
        
      case 'service.notification':
        this.emit('service-notification', message.content);
        break;
        
      case 'mcp.task.execution':
        this.emit('mcp.task.execution', message.content);
        break;
        
      case 'error':
        this.emit('orchestrator-error', message.content || { error: 'Unknown error' });
        break;
        
      default:
        console.log(`Unhandled message type: ${message.type}`);
        break;
    }
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
    this.wsClient.clearPendingResponses();
    
 
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
  async sendRequestWaitForResponse(message: Partial<BaseMessage>, options: { timeout?: number } = {}): Promise<any> {
    return this.wsClient.sendRequestWaitForResponse(message, options);
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

  /**
   * Execute a tool on an MCP server
   * @param serverId - ID of the server to execute the tool on
   * @param toolName - Name of the tool to execute
   * @param parameters - Tool parameters
   * @returns Tool execution result
   */
  async executeMCPTool(serverId: string, toolName: string, parameters: any): Promise<any> {
    return this.mcpManager.executeMCPTool(serverId, toolName, parameters);
  }
} 