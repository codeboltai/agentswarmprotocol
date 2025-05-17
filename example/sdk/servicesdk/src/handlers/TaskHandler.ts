import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskExecuteMessage, TaskHandler as TaskHandlerType } from '../core/types';

export class TaskHandler {
  private taskHandlers: Map<string, TaskHandlerType> = new Map();

  constructor(
    private webSocketManager: WebSocketManager,
    private serviceId: string,
    private logger: Console = console
  ) {}

  /**
   * Register a task handler (new API style)
   * @param {string} taskName Name of the task to handle
   * @param {Function} handler Function to call
   */
  onTask(taskName: string, handler: TaskHandlerType): this {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.taskHandlers.set(taskName, handler);
    return this;
  }

  /**
   * Handle a service task
   * @param {ServiceTaskExecuteMessage} message - The task message to handle
   */
  async handleServiceTask(message: ServiceTaskExecuteMessage): Promise<void> {
    const taskId = message.id;
    const content = message.content;
    const functionName = content.functionName;
    const params = content.params || {};
    const clientId = content.clientId;
    
    // Add clientId to params if it's already an object
    if (typeof params === 'object' && params !== null && clientId) {
      params.clientId = clientId;
    }

    try {
      // Find handler for this function
      const handler = this.taskHandlers.get(functionName);
      
      if (!handler) {
        throw new Error(`No handler registered for function: ${functionName}`);
      }
      
      // Execute the handler
      const result = await handler(params, message);
      
      // Send the result
      this.sendTaskResult(taskId, result);
    } catch (err) {
      // Handle errors
      const error = err as Error;
      this.logger.error(`Error handling task ${functionName}:`, error);
      
      // Send error result
      this.sendTaskResult(taskId, { error: error.message });
      
      // Re-throw to allow the parent to know about the error
      throw error;
    }
  }

  /**
   * Send a task result back to the orchestrator
   * @param taskId ID of the task
   * @param result Result data
   */
  sendTaskResult(taskId: string, result: any): void {
    this.webSocketManager.send({
      id: uuidv4(),
      type: 'service.task.result',
      content: {
        serviceId: this.serviceId,
        taskId,
        result
      }
    } as BaseMessage);
  }
} 