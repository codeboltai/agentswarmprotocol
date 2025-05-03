import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
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
export declare class SwarmClientSDK extends EventEmitter {
    private wsClient;
    private messageHandler;
    private defaultTimeout;
    private clientId;
    agents: AgentManager;
    tasks: TaskManager;
    mcp: MCPManager;
    /**
     * Create a new SwarmClientSDK instance
     * @param config - Configuration options
     */
    constructor(config?: SwarmClientSDKConfig);
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
    sendRequest(message: Partial<BaseMessage>, options?: {
        timeout?: number;
    }): Promise<any>;
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    sendTask(agentName: string, taskData: any, options?: any): Promise<any>;
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    getAgents(filters?: {}): Promise<any[]>;
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    listMCPServers(filters?: {}): Promise<any[]>;
}
export { WebSocketClient, MessageHandler, TaskManager, AgentManager, MCPManager };
export * from './WebSocketClient';
export * from './MessageHandler';
export * from './TaskManager';
export * from './AgentManager';
export * from './MCPManager';
