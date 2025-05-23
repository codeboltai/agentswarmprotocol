/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */
import { EventEmitter } from 'events';
import { BaseMessage, AgentStatus } from '@agentswarmprotocol/types/common';
import { AgentConfig, TaskHandler } from './core/types';
declare class SwarmAgentSDK extends EventEmitter {
    protected agentId: string;
    protected name: string;
    protected agentType: string;
    protected capabilities: string[];
    protected description: string;
    protected manifest: Record<string, any>;
    protected logger: Console;
    private webSocketManager;
    private taskHandler;
    private agentManager;
    private serviceManager;
    private mcpManager;
    constructor(config?: AgentConfig);
    /**
     * Set up event forwarding from the modules to this SDK instance
     */
    private setupEventForwarding;
    /**
     * Send registration message to the orchestrator
     * @private
     */
    private sendRegistration;
    /**
     * Process an incoming message and route it appropriately
     * @param {BaseMessage} message The message to process
     * @private
     */
    private processMessage;
    /**
     * Send a pong response for the given messageId
     * @private
     */
    private sendPong;
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect(): Promise<SwarmAgentSDK>;
    /**
     * Disconnect from the orchestrator
     */
    disconnect(): SwarmAgentSDK;
    /**
     * Set agent status
     * @param status New status
     */
    setStatus(status: AgentStatus): Promise<void>;
    /**
     * Send a request message and wait for a response
     * @param message - The message to send
     * @param options - Additional options
     * @param options.timeout - Timeout in milliseconds
     * @returns The response message
     */
    sendRequestWaitForResponse(message: Partial<BaseMessage>, options?: {
        timeout?: number;
    }): Promise<any>;
    /**
     * Register a task handler that will be called whenever a task is received
     * @param handler Task handler function
     */
    onTask(handler: TaskHandler): SwarmAgentSDK;
    /**
     * Send a message during task execution
     * @param taskId ID of the task being executed
     * @param content Message content
     */
    sendTaskMessage(taskId: string, content: any): void;
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId: string, result: any): void;
    /**
     * Send a request message during task execution and wait for a response
     * @param taskId ID of the task being executed
     * @param content Request content
     * @param timeout Timeout in milliseconds
     * @returns Promise that resolves with the response content
     */
    requestMessageDuringTask(taskId: string, content: any, timeout?: number): Promise<any>;
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    getAgentList(filters?: Record<string, any>): Promise<any[]>;
    /**
     * Request another agent to perform a task
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    executeChildAgentTask(targetAgentName: string, taskData: any, timeout?: number): Promise<any>;
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTask(serviceId: string, toolName: string, params?: Record<string, any>, options?: {
        timeout: number;
        clientId: string | undefined;
    }): Promise<any>;
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    getServiceList(filters?: Record<string, any>): Promise<any[]>;
    /**
     * Get a list of tools for a specific service
     * @param serviceId Service ID or name
     * @param options Optional parameters (e.g., timeout)
     */
    getServiceToolList(serviceId: string, options?: {
        timeout?: number;
    }): Promise<any[]>;
    /**
     * Get list of MCP servers
     * @param filters Filter criteria
     * @param timeout Request timeout
     */
    getMCPServers(filters?: Record<string, any>, timeout?: number): Promise<any[]>;
    /**
     * Get list of tools for an MCP server
     * @param serverId Server ID
     * @param timeout Request timeout
     */
    getMCPTools(serverId: string, timeout?: number): Promise<any[]>;
    /**
     * Execute an MCP tool
     * @param serverId Server ID
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param timeout Request timeout
     */
    executeMCPTool(serverId: string, toolName: string, parameters?: Record<string, any>, timeout?: number): Promise<any>;
}
export { SwarmAgentSDK };
export default SwarmAgentSDK;
