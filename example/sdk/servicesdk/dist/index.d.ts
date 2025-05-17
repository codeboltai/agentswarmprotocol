/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
import { EventEmitter } from 'events';
import { ServiceStatus } from '@agentswarmprotocol/types/common';
import { ServiceConfig, TaskHandler as TaskHandlerType, ServiceNotificationType, ServiceNotification } from './core/types';
declare class SwarmServiceSDK extends EventEmitter {
    protected serviceId: string;
    protected name: string;
    protected capabilities: string[];
    protected description: string;
    protected manifest: Record<string, any>;
    protected logger: Console;
    private webSocketManager;
    private taskHandler;
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
