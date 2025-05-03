/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BaseMessage, ServiceStatus } from '@agentswarmprotocol/types/common';
import { ServiceMessages } from '@agentswarmprotocol/types/messages';
type ServiceTaskExecuteMessage = ServiceMessages.ServiceTaskExecuteMessage;
type ServiceNotificationType = ServiceMessages.ServiceNotificationType;
interface ServiceConfig {
    serviceId?: string;
    name?: string;
    capabilities?: string[];
    description?: string;
    manifest?: Record<string, any>;
    orchestratorUrl?: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    logger?: Console;
}
interface PendingResponse {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}
type TaskHandler = (params: any, message: ServiceTaskExecuteMessage) => Promise<any>;
declare class SwarmServiceSDK extends EventEmitter {
    protected serviceId: string;
    protected name: string;
    protected capabilities: string[];
    protected description: string;
    protected manifest: Record<string, any>;
    protected orchestratorUrl: string;
    protected autoReconnect: boolean;
    protected reconnectInterval: number;
    protected connected: boolean;
    protected connecting: boolean;
    protected pendingResponses: Map<string, PendingResponse>;
    protected taskHandlers: Map<string, TaskHandler>;
    protected logger: Console;
    protected ws: WebSocket | null;
    constructor(config?: ServiceConfig);
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
     * Handle incoming messages
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message: BaseMessage): void;
    /**
     * Register a task handler (new API style)
     * @param {string} taskName Name of the task to handle
     * @param {Function} handler Function to call
     */
    onTask(taskName: string, handler: TaskHandler): SwarmServiceSDK;
    /**
     * Register a function handler (legacy API, kept for compatibility)
     * @param {string} functionName Name of the function to handle
     * @param {Function} handler Function to call
     * @deprecated Use onTask instead
     */
    registerFunction(functionName: string, handler: TaskHandler): SwarmServiceSDK;
    /**
     * Handle a service task
     * @param {ServiceTaskExecuteMessage} message - The task message to handle
     */
    handleServiceTask(message: ServiceTaskExecuteMessage): Promise<void>;
    /**
     * Send a task result back to the orchestrator
     * @param {string} taskId ID of the task
     * @param {any} result Result data
     */
    sendTaskResult(taskId: string, result: any): void;
    /**
     * Send a task notification
     * @param {string} taskId ID of the task
     * @param {string} message Notification message
     * @param {ServiceNotificationType} notificationType Type of notification
     * @param {any} data Additional data
     */
    sendTaskNotification(taskId: string, message: string, notificationType?: ServiceNotificationType, data?: any): Promise<void>;
    /**
     * Send a notification (legacy API)
     * @param {any} notification Notification data
     * @deprecated Use sendTaskNotification instead
     */
    notify(notification: any): Promise<void>;
    /**
     * Send a notification (alias of notify for backward compatibility)
     * @param {any} notification Notification data
     * @deprecated Use sendTaskNotification instead
     */
    sendNotification(notification: any): Promise<void>;
    /**
     * Send a message to the orchestrator
     * @param {BaseMessage} message Message to send
     */
    send(message: BaseMessage): Promise<BaseMessage>;
    /**
     * Send a message and wait for a response
     * @param {BaseMessage} message Message to send
     * @param {number} timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message: BaseMessage, timeout?: number): Promise<BaseMessage>;
    /**
     * Set service status
     * @param {ServiceStatus} status New status
     * @param {string} message Optional status message
     */
    setStatus(status: ServiceStatus, message?: string): Promise<void>;
}
export { SwarmServiceSDK };
export default SwarmServiceSDK;
