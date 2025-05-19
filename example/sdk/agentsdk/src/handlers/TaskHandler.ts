import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { TaskExecuteMessage, TaskHandler as TaskHandlerType } from '../core/types';
import { WebSocketManager } from '../core/WebSocketManager';

export class TaskHandler extends EventEmitter {
  private taskHandlers: Map<string, TaskHandlerType> = new Map();
  private defaultTaskHandler: TaskHandlerType | null = null;

  constructor(
    private webSocketManager: WebSocketManager,
    private agentId: string,
    private logger: Console = console
  ) {
    super();
  }

  /**
   * Register a task handler for a specific task type
   * @param taskType Type of task to handle
   * @param handler Handler function
   */
  registerTaskHandler(taskType: string, handler: TaskHandlerType): this {
    this.taskHandlers.set(taskType, handler);
    return this;
  }

  /**
   * Register a default task handler for when no specific handler is found
   * @param handler Handler function
   */
  registerDefaultTaskHandler(handler: TaskHandlerType): this {
    this.defaultTaskHandler = handler;
    return this;
  }

  /**
   * Handle an incoming task
   * @param message Task execution message
   */
  async handleTask(message: TaskExecuteMessage): Promise<void> {
    const taskId = message.content?.taskId;
    const taskType = message.content?.type;
    const taskData = message.content?.data;
    
    if (!taskId) {
      this.logger.error('Task execution message missing taskId');
      return;
    }

    // Add detailed logging about the message and task data
    this.logger.info(`Processing task ${taskId} (type: ${taskType || 'undefined'})`);
    this.logger.info(`Task message structure: ${JSON.stringify({
      hasContent: !!message.content,
      contentKeys: message.content ? Object.keys(message.content) : [],
      taskDataType: taskData ? typeof taskData : 'undefined',
      taskDataIsEmpty: taskData ? (typeof taskData === 'object' ? Object.keys(taskData).length === 0 : false) : true,
      taskDataKeys: taskData && typeof taskData === 'object' ? Object.keys(taskData) : []
    })}`);

    // Emit task event
    this.emit('task', taskData, message);
    
    if (taskType) {
      this.emit(`task.${taskType}`, taskData, message);
    }

    try {
      // Find the appropriate handler
      let handler = this.defaultTaskHandler;
      
      if (taskType && this.taskHandlers.has(taskType)) {
        handler = this.taskHandlers.get(taskType)!;
      }
      
      if (!handler) {
        throw new Error(`No handler registered for task type: ${taskType}`);
      }
      
      // Update task status
      this.sendTaskStatus(taskId, 'started');
      
      // Execute the handler
      const result = await handler(taskData, message);
      
      // Send the result
      this.sendTaskResult(taskId, result);
      
      // Update task status
      this.sendTaskStatus(taskId, 'completed');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error executing task: ${error.message}`);
      
      // Update task status
      this.sendTaskStatus(taskId, 'failed', { error: error.message });
      
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
      type: 'task.result',
      content: {
        agentId: this.agentId,
        taskId,
        result
      }
    } as BaseMessage);
  }

  /**
   * Send a task status update
   * @param taskId ID of the task
   * @param status Status to set
   * @param metadata Optional metadata
   */
  sendTaskStatus(taskId: string, status: string, metadata: Record<string, any> = {}): void {
    this.webSocketManager.send({
      id: uuidv4(),
      type: 'task.status',
      content: {
        agentId: this.agentId,
        taskId,
        status,
        ...metadata
      }
    } as BaseMessage);
  }

  /**
   * Send a message during task execution
   * @param taskId ID of the task
   * @param content Message content
   */
  sendMessage(taskId: string, content: any): void {
    this.webSocketManager.send({
      id: uuidv4(),
      type: 'task.message',
      content: {
        agentId: this.agentId,
        taskId,
        message: content
      }
    } as BaseMessage);
  }
} 