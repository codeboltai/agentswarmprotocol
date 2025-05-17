import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskExecuteMessage, TaskHandler as TaskHandlerType } from '../core/types';
export declare class TaskHandler {
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
}
