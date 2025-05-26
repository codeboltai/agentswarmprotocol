import { EventEmitter } from 'events';
import { TaskExecuteMessage, AgentTaskHandler as TaskHandlerType } from '../core/types';
import { WebSocketManager } from '../core/WebSocketManager';
export declare class TaskHandler extends EventEmitter {
    private webSocketManager;
    private agentId;
    private logger;
    private taskHandler;
    constructor(webSocketManager: WebSocketManager, agentId: string, logger?: Console);
    /**
     * Set the task handler for all incoming tasks
     * @param handler Handler function
     */
    onTask(handler: TaskHandlerType): this;
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
    sendTaskMessage(taskId: string, content: any): void;
    /**
     * Send a request message during task execution and wait for a response
     * @param taskId ID of the task being executed
     * @param content Request content
     * @param timeout Timeout in milliseconds
     * @returns Promise that resolves with the response
     */
    requestMessageDuringTask(taskId: string, content: any, timeout?: number): Promise<any>;
}
