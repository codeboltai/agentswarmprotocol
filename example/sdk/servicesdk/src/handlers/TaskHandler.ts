import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskExecuteMessage, TaskHandler as TaskHandlerType, ServiceNotificationType } from '../core/types';

export class TaskHandler extends EventEmitter {
  private taskHandlers: Map<string, TaskHandlerType> = new Map();

  constructor(
    private webSocketManager: WebSocketManager,
    private serviceId: string,
    private logger: Console = console
  ) {
    super();
  }

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
   * Register a function handler (legacy API, kept for compatibility)
   * @param {string} functionName Name of the function to handle
   * @param {Function} handler Function to call
   * @deprecated Use onTask instead
   */
  registerFunction(functionName: string, handler: TaskHandlerType): this {
    return this.onTask(functionName, handler);
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
    
    // Set up a notification helper for this task
    const notifyProgress = (
      message: string, 
      data: Record<string, any> = {}, 
      type: ServiceNotificationType = 'progress'
    ): void => {
      this.sendTaskNotification(taskId, message, type, data);
      
      // Also emit locally
      this.emit('notification', {
        taskId,
        message,
        type,
        data
      });
    };

    // Add notification helper to params if it's already an object
    if (typeof params === 'object' && params !== null) {
      params.notify = notifyProgress;
      if (clientId) {
        params.clientId = clientId;
      }
    }

    try {
      // Find handler for this function
      const handler = this.taskHandlers.get(functionName);
      
      if (!handler) {
        throw new Error(`No handler registered for function: ${functionName}`);
      }
      
      // Update task status
      notifyProgress(`Starting task: ${functionName}`, {}, 'started' as ServiceNotificationType);
      
      // Execute the handler
      const result = await handler(params, message);
      
      // Send the result
      this.sendTaskResult(taskId, result);
      
      // Update task status
      notifyProgress(`Task completed: ${functionName}`, {}, 'completed' as ServiceNotificationType);
    } catch (err) {
      // Handle errors
      const error = err as Error;
      this.logger.error(`Error handling task ${functionName}:`, error);
      
      // Update task status
      notifyProgress(`Task failed: ${error.message}`, { error: error.message }, 'failed' as ServiceNotificationType);
      
      // Send error result
      this.sendTaskResult(taskId, { error: error.message });
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

  /**
   * Send a task notification
   * @param taskId ID of the task
   * @param message Message content
   * @param notificationType Type of notification
   * @param data Additional data
   */
  async sendTaskNotification(
    taskId: string, 
    message: string, 
    notificationType: ServiceNotificationType = 'info', 
    data: any = {}
  ): Promise<void> {
    await this.webSocketManager.send({
      id: uuidv4(),
      type: 'service.task.notification',
      content: {
        serviceId: this.serviceId,
        taskId,
        notification: {
          type: notificationType,
          message,
          timestamp: new Date().toISOString(),
          data
        }
      }
    } as BaseMessage);
  }
} 