/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
import { EventEmitter } from 'events';
import { BaseMessage, ServiceStatus } from '@agentswarmprotocol/types/common';
import { ServiceConfig, TaskHandler as TaskHandlerType, ServiceNotificationType } from './core/types';
declare class SwarmServiceSDK extends EventEmitter {
    protected serviceId: string;
    protected name: string;
    protected capabilities: string[];
    protected description: string;
    protected manifest: Record<string, any>;
    protected logger: Console;
    private webSocketManager;
    private messageHandler;
    private taskHandler;
    private notificationManager;
    private statusManager;
    constructor(config?: ServiceConfig);
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
     * Register a task handler (new API style)
     * @param {string} taskName Name of the task to handle
     * @param {Function} handler Function to call
     */
    onTask(taskName: string, handler: TaskHandlerType): SwarmServiceSDK;
    /**
     * Register a function handler (legacy API, kept for compatibility)
     * @param {string} functionName Name of the function to handle
     * @param {Function} handler Function to call
     * @deprecated Use onTask instead
     */
    registerFunction(functionName: string, handler: TaskHandlerType): SwarmServiceSDK;
    /**
     * Handle incoming messages (exposed mainly for testing)
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message: BaseMessage): void;
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId: string, result: any): void;
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
    notify(notification: any): Promise<void>;
    /**
     * Send a notification to the orchestrator
     * @param notification Notification data
     */
    sendNotification(notification: any): Promise<void>;
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
     * Set service status
     * @param status New status
     * @param message Status message
     */
    setStatus(status: ServiceStatus, message?: string): Promise<void>;
}
export { SwarmServiceSDK };
export default SwarmServiceSDK;
