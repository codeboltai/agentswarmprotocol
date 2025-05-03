/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */
import { EventEmitter } from 'events';
import { BaseMessage, AgentStatus } from '@agentswarmprotocol/types/common';
import { AgentConfig, MessageHandler, TaskHandler } from './core/types';
declare class SwarmAgentSDK extends EventEmitter {
    protected agentId: string;
    protected name: string;
    protected agentType: string;
    protected capabilities: string[];
    protected description: string;
    protected manifest: Record<string, any>;
    protected logger: Console;
    private webSocketManager;
    private messageHandler;
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
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect(): Promise<SwarmAgentSDK>;
    /**
     * Disconnect from the orchestrator
     */
    disconnect(): SwarmAgentSDK;
    /**
     * Expose the handleMessage method (mainly for testing)
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message: BaseMessage): void;
    /**
     * Register a message handler for a specific message type
     * @param messageType Type of message to handle
     * @param handler Handler function
     */
    onMessage(messageType: string, handler: MessageHandler): SwarmAgentSDK;
    /**
     * Send a message during task execution
     * @param taskId ID of the task being executed
     * @param content Message content
     */
    sendMessage(taskId: string, content: any): void;
    /**
     * Register a task handler for a specific task type
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    registerTaskHandler(taskType: string, handler: TaskHandler): SwarmAgentSDK;
    /**
     * Register a default task handler for when no specific handler is found
     * @param handler Handler function
     */
    registerDefaultTaskHandler(handler: TaskHandler): SwarmAgentSDK;
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId: string, result: any): void;
    /**
     * Send a message to the orchestrator
     * @param message Message to send
     */
    send(message: BaseMessage): Promise<BaseMessage>;
    /**
     * Send a message and wait for a response
     * @param message Message to send
     * @param timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message: BaseMessage, timeout?: number): Promise<BaseMessage>;
    /**
     * Request another agent to perform a task
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    requestAgentTask(targetAgentName: string, taskData: any, timeout?: number): Promise<any>;
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    getAgentList(filters?: Record<string, any>): Promise<any[]>;
    /**
     * Set agent status
     * @param status New status
     */
    setStatus(status: AgentStatus): Promise<void>;
    /**
     * Execute a task on another agent
     * @param targetAgentName Name of the target agent
     * @param taskType Type of task
     * @param taskData Task data
     * @param timeout Request timeout
     */
    executeAgentTask(targetAgentName: string, taskType: string, taskData?: Record<string, any>, timeout?: number): Promise<any>;
    /**
     * Register a handler for agent requests
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    onAgentRequest(taskType: string, handler: TaskHandler): SwarmAgentSDK;
    /**
     * Request a service
     * @param serviceName Name of the service
     * @param params Service parameters
     * @param timeout Request timeout
     */
    requestService(serviceName: string, params?: Record<string, any>, timeout?: number): Promise<any>;
    /**
     * Convenience method for executing a service
     * @param serviceName Name of the service
     * @param params Parameters to pass
     * @param timeout Request timeout
     */
    executeService(serviceName: string, params?: Record<string, any>, timeout?: number): Promise<any>;
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTask(serviceId: string, functionName: string, params?: Record<string, any>, options?: {
        timeout: number;
        onNotification: ((notification: any) => void) | undefined;
        clientId: string | undefined;
    }): Promise<any>;
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    getServiceList(filters?: Record<string, any>): Promise<any[]>;
    /**
     * Request MCP service
     * @param params Service parameters
     * @param timeout Request timeout
     * @deprecated Use getMCPServers, getMCPTools, and executeMCPTool instead
     */
    requestMCPService(params?: Record<string, any>, timeout?: number): Promise<any>;
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
    /**
     * Execute a tool by name (will find server automatically)
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param serverId Optional server ID (if known)
     * @param timeout Request timeout
     */
    executeTool(toolName: string, parameters?: Record<string, any>, serverId?: string | null, timeout?: number): Promise<any>;
    /**
     * Send a task notification
     * @param notification Notification data
     */
    sendTaskNotification(notification: any): Promise<void>;
    /**
     * Register a handler for notifications
     * @param handler Handler function
     */
    onNotification(handler: (notification: any) => void): SwarmAgentSDK;
}
export { SwarmAgentSDK };
export default SwarmAgentSDK;
