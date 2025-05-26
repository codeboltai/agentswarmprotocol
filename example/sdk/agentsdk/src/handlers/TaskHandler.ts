import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { TaskExecuteMessage, AgentTaskHandler as TaskHandlerType } from '../core/types';
import { WebSocketManager } from '../core/WebSocketManager';

export class TaskHandler extends EventEmitter {
  // Remove taskHandlers map since we'll only have one handler
  // private taskHandlers: Map<string, TaskHandlerType> = new Map();
  private taskHandler: TaskHandlerType | null = null;

  constructor(
    private webSocketManager: WebSocketManager,
    private agentId: string,
    private logger: Console = console
  ) {
    super();
  }

  /**
   * Set the task handler for all incoming tasks
   * @param handler Handler function
   */
  onTask(handler: TaskHandlerType): this {
    this.taskHandler = handler;
    return this;
  }

  /**
   * Handle an incoming task
   * @param message Task execution message
   */
  async handleTask(message: TaskExecuteMessage): Promise<void> {
    const taskId = message.content?.taskId;
    const taskData = message.content?.data;
    
    if (!taskId) {
      this.logger.error('Task execution message missing taskId');
      return;
    }

    // Add detailed logging about the message and task data
    this.logger.info(`Processing task ${taskId}`);
    this.logger.info(`Task message structure: ${JSON.stringify({
      hasContent: !!message.content,
      contentKeys: message.content ? Object.keys(message.content) : [],
      taskDataType: taskData ? typeof taskData : 'undefined',
      taskDataIsEmpty: taskData ? (typeof taskData === 'object' ? Object.keys(taskData).length === 0 : false) : true,
      taskDataKeys: taskData && typeof taskData === 'object' ? Object.keys(taskData) : []
    })}`);

    // Emit task event
    this.emit('task', taskData, message);

    try {
      // Check if we have a handler
      if (!this.taskHandler) {
        throw new Error('No task handler registered');
      }
      
      // Update task status
      this.sendTaskStatus(taskId, 'started');
      
      // Execute the handler
      const result = await this.taskHandler(taskData, message);
      
      // Send the result
      this.sendTaskResult(taskId, result);
      
      // Update task status with the result to ensure completion is recognized
      this.sendTaskStatus(taskId, 'completed', { result });
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
      type: 'agent.task.result',
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
  sendTaskMessage(taskId: string, content: any): void {
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

  /**
   * Send a request message during task execution and wait for a response
   * @param taskId ID of the task being executed
   * @param content Request content
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with the response
   */
  requestMessageDuringTask(taskId: string, content: any, timeout = 30000): Promise<any> {
    const requestId = uuidv4();
    return this.webSocketManager.sendAndWaitForResponse({
      id: requestId,
      type: 'task.requestmessage',
      content: {
        agentId: this.agentId,
        taskId,
        request: content
      }
    } as BaseMessage, timeout)
    .then(response => {
      if (response.content && response.content.result) {
        return response.content.result;
      }
      return response.content;
    });
  }
} 