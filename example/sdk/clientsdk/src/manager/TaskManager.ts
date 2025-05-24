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
  async sendTask(agentId: string, agentName:string, taskData: any, options: TaskRequestOptions = {}): Promise<any> {
    console.log(`Sending task to agent ${agentId}`);
    
    // Create the waitForResult option with a default of true
    const waitForResult = options.waitForResult !== false;
    const timeout = options.timeout || 60000; // Default 60 second timeout
    
    // Create task
    const response = await this.wsClient.sendRequestWaitForResponse({
      type: 'client.agent.task.create.request',
      content: {
        event: 'task.completed',
        agentId,
        agentName,
        taskData
      },
      // Set noTimeout to true to prevent the WebSocketClient from timing out
      // We'll handle timeout ourselves with our specific event listeners
      noTimeout: true,
    
    },{  customEvent: 'task.result'});
    
    // If we don't need to wait for the result, return immediately
    if (!waitForResult) {
      return response.content;
    }
    
    const taskId = response.content.taskId;
    console.log(`Waiting for result for task: ${taskId}`);
    
    // Wait for the task result
    return new Promise((resolve, reject) => {
      let taskResolved = false;
      
      // Set a timeout to fail if the task takes too long
      const timeoutId = setTimeout(() => {
        if (!taskResolved) {
          console.log(`Task timeout triggered for task ${taskId}`);
          cleanup();
          reject(new Error(`Task timeout after ${timeout}ms: ${taskId}`));
        }
      }, timeout);
      
      // Handler for raw messages from WebSocketClient
      const messageHandler = (message: any) => {
        // Handle task result messages
        if (message.type === 'client.agent.task.result' && message.content && message.content.taskId === taskId) {
          console.log(`Received task result for task ${taskId}`, message.content);
          taskResolved = true;
          cleanup();
          resolve(message.content);
        }
        
        // Handle task error messages
        if (message.type === 'task.error' && message.content && message.content.taskId === taskId) {
          console.log(`Task ${taskId} failed: ${message.content.error || 'Unknown error'}`);
          taskResolved = true;
          cleanup();
          reject(new Error(`Task failed: ${message.content.error || 'Unknown error'}`));
        }
      };
      
      // Function to clean up event listeners
      const cleanup = () => {
        console.log(`Cleaning up event listeners for task ${taskId}`);
        clearTimeout(timeoutId);
        this.wsClient.removeListener('message', messageHandler);
      };
      
      // Set up message listener
      this.wsClient.on('message', messageHandler);
    });
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
   * @returns Task status information
   */
  async getTaskStatus(taskId: string): Promise<any> {
    console.log(`Getting status for task ${taskId}`);
    
    const response = await this.wsClient.sendRequestWaitForResponse({
      type: 'client.agent.task.status',
      content: {
        taskId
      }
    });
    
    return response.content;
  }
} 