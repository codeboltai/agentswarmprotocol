import { EventEmitter } from 'events';
import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskExecuteMessage, TaskHandler as TaskHandlerType, ServiceNotificationType } from '../core/types';
export declare class TaskHandler extends EventEmitter {
    private webSocketManager;
    private serviceId;
    private logger;
    private taskHandlers;
    constructor(webSocketManager: WebSocketManager, serviceId: string, logger?: Console);
    /**
     * Register a task handler (new API style)
     * @param {string} taskName Name of the task to handle
     * @param {Function} handler Function to call
     */
    onTask(taskName: string, handler: TaskHandlerType): this;
    /**
     * Register a function handler (legacy API, kept for compatibility)
     * @param {string} functionName Name of the function to handle
     * @param {Function} handler Function to call
     * @deprecated Use onTask instead
     */
    registerFunction(functionName: string, handler: TaskHandlerType): this;
    /**
     * Handle a service task
     * @param {ServiceTaskExecuteMessage} message - The task message to handle
     */
    handleServiceTask(message: ServiceTaskExecuteMessage): Promise<void>;
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
}
