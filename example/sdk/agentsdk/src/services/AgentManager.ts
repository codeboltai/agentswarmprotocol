import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, AgentStatus } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { TaskHandler as TaskHandlerType } from '../core/types';

export class AgentManager {
  constructor(
    private webSocketManager: WebSocketManager,
    private agentId: string,
    private logger: Console = console
  ) {}

  /**
   * Get list of agents
   * @param filters Filter criteria
   */
  async getAgentList(filters: Record<string, any> = {}): Promise<any[]> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'agent.list',
      content: { filters }
    } as BaseMessage);
    
    return response.content.agents || [];
  }

  /**
   * Set agent status
   * @param status New status
   */
  async setStatus(status: AgentStatus): Promise<void> {
    await this.webSocketManager.send({
      id: uuidv4(),
      type: 'agent.status',
      content: {
        agentId: this.agentId,
        status
      }
    } as BaseMessage);
  }

  /**
   * Request a task from another agent
   * @param targetAgentName Name of the target agent
   * @param taskData Task data
   * @param timeout Request timeout
   */
  async requestAgentTask(targetAgentName: string, taskData: any, timeout = 30000): Promise<any> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'agent.request',
      content: {
        targetAgent: targetAgentName,
        taskData
      }
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.result;
  }

  /**
   * Execute a task on another agent
   * @param targetAgentName Name of the target agent
   * @param taskType Type of task
   * @param taskData Task data
   * @param timeout Request timeout
   */
  async executeAgentTask(
    targetAgentName: string, 
    taskType: string, 
    taskData: Record<string, any> = {}, 
    timeout = 30000
  ): Promise<any> {
    // Add task type to the request data
    const taskRequestData = {
      type: taskType,
      ...taskData
    };
    
    return this.requestAgentTask(targetAgentName, taskRequestData, timeout);
  }

  /**
   * Register a handler for agent requests
   * @param taskType Type of task to handle
   * @param handler Handler function
   */
  onAgentRequest(taskType: string, handler: TaskHandlerType): this {
    // This would register a task handler with the passed taskType
    // Implementation depends on how TaskHandler class is used
    this.emit('register-task-handler', taskType, handler);
    return this;
  }

  // Event emitter for internal communication
  private emit(event: string, ...args: any[]): void {
    // This is a simplified version - in a real implementation, you'd use EventEmitter
    this.logger.debug(`AgentManager emitting ${event}`);
  }
} 