import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketClientConfig } from '@agentswarmprotocol/types/sdk/clientsdk';
import { MCPServerFilters } from './manager/MCPManager';
import { AgentFilters, TaskRequestOptions } from './types';
/**
 * SwarmClientSDK - Client SDK for Agent Swarm Protocol
 * Handles client-side communication with the orchestrator
 */
export declare class SwarmClientSDK extends EventEmitter {
    private wsClient;
    private clientId;
    private agentManager;
    private taskManager;
    private mcpManager;
    /**
     * Create a new SwarmClientSDK instance
     * @param config - Configuration options
     */
    constructor(config?: WebSocketClientConfig);
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    private handleMessage;
    /**
     * Connect to the orchestrator
     * @returns Promise that resolves when connected
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the orchestrator
     */
    disconnect(): void;
    /**
     * Check if connected to the orchestrator
     * @returns Whether the client is connected
     */
    isConnected(): boolean;
    /**
     * Get the client ID
     * @returns The client ID or null if not connected
     */
    getClientId(): string | null;
    /**
     * Send a request to the orchestrator
     * @param message - The message to send
     * @param options - Additional options
     * @returns The response message
     */
    sendRequestWaitForResponse(message: Partial<BaseMessage>, options?: {
        timeout?: number;
    }): Promise<any>;
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    sendTask(agentName: string, taskData: any, options?: TaskRequestOptions): Promise<any>;
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status
     */
    getTaskStatus(taskId: string): Promise<any>;
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    getAgentsList(filters?: AgentFilters): Promise<any[]>;
    sendMessageDuringTask(taskId: string, message: any): Promise<any>;
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    listMCPServers(filters?: MCPServerFilters): Promise<any[]>;
    /**
     * Get tools available on an MCP server
     * @param serverId - ID of the server to get tools for
     * @returns List of tools
     */
    getMCPServerTools(serverId: string): Promise<any[]>;
    /**
     * Execute a tool on an MCP server
     * @param serverId - ID of the server to execute the tool on
     * @param toolName - Name of the tool to execute
     * @param parameters - Tool parameters
     * @returns Tool execution result
     */
    executeMCPTool(serverId: string, toolName: string, parameters: any): Promise<any>;
}
