import { Task, TaskStatus } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from '../service/WebSocketClient';
import { EventEmitter } from 'events';
import { TaskRequestOptions } from '../types';
import { SwarmClientSDK } from '../index';

/**
 * TaskManager - Handles task-related operations
 */
export class TaskManager {
  private wsClient: WebSocketClient;
  private sdk: SwarmClientSDK;

  /**
   * Create a new TaskManager instance
   * @param wsClient - WebSocketClient instance
   * @param sdk - SwarmClientSDK instance for event listening
   */
  constructor(wsClient: WebSocketClient, sdk: EventEmitter) {
    this.wsClient = wsClient;
    this.sdk = sdk as SwarmClientSDK;
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
      return response.content;
  
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