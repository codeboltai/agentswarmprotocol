import { EventEmitter } from 'events';
import { TaskStatus } from '@agentswarmprotocol/types/common';
/**
 * Task request options
 */
export interface TaskRequestOptions {
    /** Whether to wait for the task result */
    waitForResult?: boolean;
    /** Timeout in milliseconds */
    timeout?: number;
}
/**
 * TaskManager - Handles task-related operations
 */
export declare class TaskManager extends EventEmitter {
    private sendRequest;
    /**
     * Create a new TaskManager instance
     * @param sendRequest - Function to send requests
     */
    constructor(sendRequest: (message: any) => Promise<any>);
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    sendTask(agentName: string, taskData: any, options?: TaskRequestOptions): Promise<any>;
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status
     */
    getTaskStatus(taskId: string): Promise<{
        status: TaskStatus;
        result?: any;
    }>;
    /**
     * Register event listeners for task events
     * @param emitter - Event emitter to listen to
     */
    registerEventListeners(emitter: EventEmitter): void;
}
