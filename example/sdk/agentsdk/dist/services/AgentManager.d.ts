import { AgentStatus } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { TaskHandler as TaskHandlerType } from '../core/types';
export declare class AgentManager {
    private webSocketManager;
    private agentId;
    private logger;
    constructor(webSocketManager: WebSocketManager, agentId: string, logger?: Console);
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    getAgentList(filters?: Record<string, any>): Promise<any[]>;
    /**
     * Set agent status
     * @param status New status
     */
    setStatus(status: AgentStatus): Promise<void>;
    /**
     * Request a task from another agent
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    requestAgentTask(targetAgentName: string, taskData: any, timeout?: number): Promise<any>;
    /**
     * Execute a task on another agent
     * @param targetAgentName Name of the target agent
     * @param taskType Type of task
     * @param taskData Task data
     * @param timeout Request timeout
     */
    executeAgentTask(targetAgentName: string, taskType: string, taskData?: Record<string, any>, timeout?: number): Promise<any>;
    /**
     * Register a handler for agent requests
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    onAgentRequest(taskType: string, handler: TaskHandlerType): this;
    private emit;
}
