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

  /**
   * Create a new TaskManager instance
   * @param wsClient - WebSocketClient instance
   */
  constructor(wsClient: WebSocketClient) {
    this.wsClient = wsClient;
  }

  /**
   * Send a task to an agent
   * @param agentId - Name of the agent to send the task to
   * @param taskData - Task data to send
   * @param options - Additional options
   * @returns Task information
   */
  async sendTask(agentId: string, taskData: any, options: TaskRequestOptions = {}): Promise<any> {

    console.log(`Sending task to agent ${agentId}`);
    
    // Create task
    const response = await this.wsClient.sendRequestWaitForResponse({
      type: 'task.create',
      content: {
        event: 'task.completed',
        agentId,
        taskData
      }
    });
      return response.content;
  
  }

  /**
   * Send a message to a running task
   * @param taskId - ID of the task to send the message to
   * @param message - Message to send (can be string or structured data)
   * @param options - Additional options like message type
   * @returns Response from the message delivery
   */
  async sendMessageDuringTask(
    taskId: string, 
    message: string | Record<string, any>, 
    options: { 
      messageType?: string,
      timeout?: number
    } = {}
  ): Promise<any> {
    console.log(`Sending message to task ${taskId}`);
    
    const messageType = options.messageType || 'client.message';
    const timeout = options.timeout || 30000;
    
    // Prepare message content
    const messageContent = typeof message === 'string' 
      ? { text: message } 
      : message;
    
    // Send the message to the task without waiting for a response
    const response = await this.wsClient.send({
      type: 'task.message',
      content: {
        taskId,
        messageType,
        message: messageContent
      }
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