import { Task, TaskStatus } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from '../service/WebSocketClient';
import { EventEmitter } from 'events';
import { TaskRequestOptions } from '../types';



/**
 * TaskManager - Handles task-related operations
 */
export class TaskManager {
  private wsClient: WebSocketClient;
  private sdk: EventEmitter;

  /**
   * Create a new TaskManager instance
   * @param wsClient - WebSocketClient instance
   * @param sdk - SwarmClientSDK instance for event listening
   */
  constructor(wsClient: WebSocketClient, sdk: EventEmitter) {
    this.wsClient = wsClient;
    this.sdk = sdk;
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
    const response = await this.wsClient.sendRequestWaitForResponse({
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
        this.sdk.removeListener('task-result', resultHandler);
        this.sdk.removeListener('task-status', statusHandler);
      };
      
      // Listen to events from the SDK instead of from this instance
      this.sdk.on('task-result', resultHandler);
      this.sdk.on('task-status', statusHandler);
    });
  }

  /**
   * Get the status of a task
   * @param taskId - ID of the task to get status for
   * @returns Task status
   */
  async getTaskStatus(taskId: string): Promise<{ status: TaskStatus; result?: any }> {
    const response = await this.wsClient.sendRequestWaitForResponse({
      type: 'task.status',
      content: {
        taskId
      }
    });
    
    return response.content;
  }
} 