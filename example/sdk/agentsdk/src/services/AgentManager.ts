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
    const response = await this.webSocketManager.sendRequestWaitForResponse({
      type: 'agent.agent.list.request',
      content: { filters }
    }, {
      customEvent: 'agent.agent.list.response'
    });
    
    return response.content.agents;
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
  async executeChildAgentTask(targetAgentName: string, taskData: any, timeout = 30000): Promise<any> {
    // Use sendRequestWaitForResponse with custom event to wait for childagent.response
    const response = await this.webSocketManager.sendRequestWaitForResponse({
      id: uuidv4(),
      type: 'agent.request',
      content: {
        targetAgent: targetAgentName,
        taskData
      }
    }, {
      timeout,
      customEvent: 'childagent.response',
      anyMessageId: true
    });
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    // The response structure is: response.content.result.result
    // where the first .result is the orchestrator wrapper and the second .result is the actual task result
    return response.content.result?.result || response.content.result;
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