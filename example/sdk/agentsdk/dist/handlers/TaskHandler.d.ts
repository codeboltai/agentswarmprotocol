import { EventEmitter } from 'events';
import { TaskExecuteMessage, TaskHandler as TaskHandlerType } from '../core/types';
import { WebSocketManager } from '../core/WebSocketManager';
export declare class TaskHandler extends EventEmitter {
    private webSocketManager;
    private agentId;
    private logger;
    private taskHandlers;
    private defaultTaskHandler;
    constructor(webSocketManager: WebSocketManager, agentId: string, logger?: Console);
    /**
     * Register a task handler for a specific task type
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    registerTaskHandler(taskType: string, handler: TaskHandlerType): this;
    /**
     * Register a default task handler for when no specific handler is found
     * @param handler Handler function
     */
    registerDefaultTaskHandler(handler: TaskHandlerType): this;
    /**
     * Handle an incoming task
     * @param message Task execution message
     */
    handleTask(message: TaskExecuteMessage): Promise<void>;
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId: string, result: any): void;
    /**
     * Send a task status update
     * @param taskId ID of the task
     * @param status Status to set
     * @param metadata Optional metadata
     */
    sendTaskStatus(taskId: string, status: string, metadata?: Record<string, any>): void;
    /**
     * Send a message during task execution
     * @param taskId ID of the task
     * @param content Message content
     */
    sendMessage(taskId: string, content: any): void;
}
