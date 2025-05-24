import { WebSocketClient } from '../service/WebSocketClient';
import { TaskRequestOptions } from '../types';
/**
 * TaskManager - Handles task-related operations
 */
export declare class TaskManager {
    private wsClient;
    /**
     * Create a new TaskManager instance
     * @param wsClient - WebSocketClient instance
     */
    constructor(wsClient: WebSocketClient);
    /**
     * Send a task to an agent
     * @param agentId - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    sendTask(agentId: string, agentName: string, taskData: any, options?: TaskRequestOptions): Promise<any>;
    /**
     * Send a message to a running task
     * @param taskId - ID of the task to send the message to
     * @param message - Message to send (can be string or structured data)
     * @param options - Additional options like message type
     * @returns Response from the message delivery
     */
    sendMessageDuringTask(taskId: string, message: string | Record<string, any>, options?: {
        messageType?: string;
        timeout?: number;
    }): Promise<any>;
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status information
     */
    getTaskStatus(taskId: string): Promise<any>;
}
