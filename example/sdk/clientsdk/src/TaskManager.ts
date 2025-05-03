import { EventEmitter } from 'events';
import { Task, TaskStatus } from '@agentswarmprotocol/types/common';

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
export class TaskManager extends EventEmitter {
  private sendRequest: (message: any) => Promise<any>;

  /**
   * Create a new TaskManager instance
   * @param sendRequest - Function to send requests
   */
  constructor(sendRequest: (message: any) => Promise<any>) {
    super();
    this.sendRequest = sendRequest;
  }

  /**
   * Send a task to an agent
   * @param agentName - Name of the agent to send the task to
   * @param taskData - Task data to send
   * @param options - Additional options
   * @returns Task information
   */
  async sendTask(agentName: string, taskData: any, options: TaskRequestOptions = {}): Promise<any> {
    const waitForResult = options.waitForResult !== false;
    const timeout = options.timeout || 60000; // Default 60 second timeout
    
    console.log(`Sending task to agent ${agentName}`);
    
    // Create task
    const response = await this.sendRequest({
      type: 'task.create',
      content: {
        agentName,
        taskData
      }
    });
    
    const taskId = response.content.taskId;
    
    if (!waitForResult) {
      return response.content;
    }
    
    // Wait for task result
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Task timeout after ${timeout}ms: ${taskId}`));
      }, timeout);
      
      const resultHandler = (result: any) => {
        if (result.taskId === taskId) {
          cleanup();
          resolve(result);
        }
      };
      
      const statusHandler = (status: any) => {
        if (status.taskId === taskId && status.status === 'failed') {
          cleanup();
          reject(new Error(`Task failed: ${status.error?.message || 'Unknown error'}`));
        }
      };
      
      const cleanup = () => {
        clearTimeout(timeoutId);
        this.removeListener('task-result', resultHandler);
        this.removeListener('task-status', statusHandler);
      };
      
      this.on('task-result', resultHandler);
      this.on('task-status', statusHandler);
    });
  }

  /**
   * Get the status of a task
   * @param taskId - ID of the task to get status for
   * @returns Task status
   */
  async getTaskStatus(taskId: string): Promise<{ status: TaskStatus; result?: any }> {
    const response = await this.sendRequest({
      type: 'task.status',
      content: {
        taskId
      }
    });
    
    return response.content;
  }

  /**
   * Register event listeners for task events
   * @param emitter - Event emitter to listen to
   */
  registerEventListeners(emitter: EventEmitter): void {
    emitter.on('task-created', (data: any) => {
      this.emit('task-created', data);
    });
    
    emitter.on('task-status', (data: any) => {
      this.emit('task-status', data);
    });
    
    emitter.on('task-result', (data: any) => {
      this.emit('task-result', data);
    });
    
    emitter.on('task-notification', (data: any) => {
      this.emit('task-notification', data);
    });
  }
} 