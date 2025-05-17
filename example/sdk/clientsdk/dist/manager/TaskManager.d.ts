import { TaskStatus } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from '../service/WebSocketClient';
import { EventEmitter } from 'events';
import { TaskRequestOptions } from '../types';
/**
 * TaskManager - Handles task-related operations
 */
export declare class TaskManager {
    private wsClient;
    private sdk;
    /**
     * Create a new TaskManager instance
     * @param wsClient - WebSocketClient instance
     * @param sdk - SwarmClientSDK instance for event listening
     */
    constructor(wsClient: WebSocketClient, sdk: EventEmitter);
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
}
