/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
import { EventEmitter } from 'events';
import { ServiceStatus } from '@agentswarmprotocol/types/common';
import { ServiceConfig, ServiceTool, TaskHandler as TaskHandlerType, ServiceNotificationType, ServiceNotification } from './core/types';
declare class SwarmServiceSDK extends EventEmitter {
    protected serviceId: string;
    protected name: string;
    protected capabilities: string[];
    protected tools: Map<string, ServiceTool>;
    protected description: string;
    protected manifest: Record<string, any>;
    protected logger: Console;
    private webSocketManager;
    private taskHandler;
    constructor(config?: ServiceConfig);
    /**
     * Generate a consistent serviceId based on service name
     * @param serviceName The name of the service
     * @returns A consistent serviceId without spaces
     */
    private generateConsistentServiceId;
    /**
     * Set up event forwarding from the modules to this SDK instance
     */
    private setupEventForwarding;
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect(): Promise<SwarmServiceSDK>;
    /**
     * Disconnect from the orchestrator
     */
    disconnect(): SwarmServiceSDK;
    /**
     * Register a tool with its handler
     * @param {string} toolId Unique identifier for the tool
     * @param {ServiceTool} toolInfo Tool information
     * @param {Function} handler Function to call when tool is executed
     */
    registerTool(toolId: string, toolInfo: Omit<ServiceTool, 'id'>, handler: TaskHandlerType): SwarmServiceSDK;
    /**
     * Register a task handler (legacy API - now registers as a tool)
     * @param {string} toolId ID of the tool to handle
     * @param {Function} handler Function to call
     */
    onTask(toolId: string, handler: TaskHandlerType): SwarmServiceSDK;
    /**
     * Get all registered tools
     * @returns Array of tools
     */
    getTools(): ServiceTool[];
    /**
     * Get a specific tool by ID
     * @param toolId Tool ID
     * @returns Tool or undefined if not found
     */
    getTool(toolId: string): ServiceTool | undefined;
    /**
     * Set service status
     * @param status New status
     * @param message Status message
     */
    setStatus(status: ServiceStatus, message?: string): Promise<void>;
    /**
   * Send a task notification
   * @param taskId ID of the task
   * @param message Message content
   * @param notificationType Type of notification
   * @param data Additional data
   */
    sendTaskNotification(taskId: string, message: string, notificationType?: ServiceNotificationType, data?: any): Promise<void>;
    /**
     * Send a general notification to clients
     * @param notification Notification data
     */
    sendClientInfoNotification(notification: any): Promise<void>;
    /**
     * Send a notification to the orchestrator
     * @param notification Notification data
     */
    sendOrchestratorNotification(notification: ServiceNotification | any): Promise<void>;
}
export { SwarmServiceSDK };
export default SwarmServiceSDK;
