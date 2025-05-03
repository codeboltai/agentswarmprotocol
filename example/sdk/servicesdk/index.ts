/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  BaseMessage,
  ServiceStatus
} from '@agentswarmprotocol/types/common';
import { ServiceMessages } from '@agentswarmprotocol/types/messages';

// Use more specific types from service messages
type ServiceTaskExecuteMessage = ServiceMessages.ServiceTaskExecuteMessage;
type ServiceNotificationType = ServiceMessages.ServiceNotificationType;

interface ServiceConfig {
  serviceId?: string;
  name?: string;
  capabilities?: string[];
  description?: string;
  manifest?: Record<string, any>;
  orchestratorUrl?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  logger?: Console;
}

interface PendingResponse {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

type TaskHandler = (params: any, message: ServiceTaskExecuteMessage) => Promise<any>;

class SwarmServiceSDK extends EventEmitter {
  protected serviceId: string;
  protected name: string;
  protected capabilities: string[];
  protected description: string;
  protected manifest: Record<string, any>;
  protected orchestratorUrl: string;
  protected autoReconnect: boolean;
  protected reconnectInterval: number;
  protected connected: boolean;
  protected connecting: boolean;
  protected pendingResponses: Map<string, PendingResponse>;
  protected taskHandlers: Map<string, TaskHandler>;
  protected logger: Console;
  protected ws: WebSocket | null;

  constructor(config: ServiceConfig = {}) {
    super();
    
    this.serviceId = config.serviceId || uuidv4();
    this.name = config.name || 'Generic Service';
    this.capabilities = config.capabilities || [];
    this.description = config.description || 'Generic Service';
    this.manifest = config.manifest || {};
    this.orchestratorUrl = config.orchestratorUrl || 'ws://localhost:3002';
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.connected = false;
    this.connecting = false;
    this.pendingResponses = new Map();
    this.taskHandlers = new Map();
    this.ws = null;
    
    // Set up basic logger
    this.logger = config.logger || console;
  }

  /**
   * Connect to the orchestrator
   * @returns {Promise} Resolves when connected
   */
  connect(): Promise<SwarmServiceSDK> {
    if (this.connected || this.connecting) {
      return Promise.resolve(this);
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.orchestratorUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.connecting = false;
          
          // Register service with orchestrator
          this.send({
            type: 'service.register',
            content: {
              name: this.name,
              capabilities: this.capabilities,
              manifest: this.manifest
            }
          } as BaseMessage)
          .then(response => {
            // Store the assigned service ID if provided
            if (response && response.content && response.content.serviceId) {
              this.serviceId = response.content.serviceId;
            }
            this.emit('registered', response.content);
          })
          .catch(err => {
            this.emit('error', new Error(`Failed to register: ${err.message}`));
          });
          
          this.emit('connected');
          resolve(this);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as BaseMessage;
            this.handleMessage(message);
          } catch (err) {
            const error = err as Error;
            this.emit('error', new Error(`Failed to parse message: ${error.message}`));
          }
        });

        this.ws.on('error', (error) => {
          this.emit('error', error);
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.connecting = false;
          this.emit('disconnected');
          
          if (this.autoReconnect) {
            setTimeout(() => {
              this.connect().catch(err => {
                this.emit('error', new Error(`Reconnection failed: ${err.message}`));
              });
            }, this.reconnectInterval);
          }
        });
      } catch (err) {
        this.connecting = false;
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): SwarmServiceSDK {
    if (this.ws) {
      this.autoReconnect = false;
      this.ws.close();
    }
    return this;
  }

  /**
   * Handle incoming messages
   * @param {BaseMessage} message The message to handle
   */
  handleMessage(message: BaseMessage): void {
    this.emit('message', message);
    
    if (message.requestId && this.pendingResponses.has(message.requestId)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.requestId)!;
      clearTimeout(timeout);
      this.pendingResponses.delete(message.requestId);
      
      if (message.type === 'error' || (message.content && message.content.error)) {
        reject(new Error(message.content ? message.content.error : 'Unknown error'));
      } else {
        resolve(message);
      }
      return;
    }

    // Handle service task specially
    if (message.type === 'service.task.execute') {
      this.handleServiceTask(message as ServiceTaskExecuteMessage);
      return;
    }

    // Emit for the specific message type
    this.emit(message.type, message.content, message);

    // For standard message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
        
      case 'service.registered':
        this.emit('registered', message.content);
        break;
        
      case 'notification.received':
        this.emit('notification-received', message.content);
        break;
        
      case 'ping':
        this.send({ type: 'pong', id: message.id, content: {} } as BaseMessage);
        break;
        
      case 'error':
        this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
        break;
    }
  }

  /**
   * Register a task handler (new API style)
   * @param {string} taskName Name of the task to handle
   * @param {Function} handler Function to call
   */
  onTask(taskName: string, handler: TaskHandler): SwarmServiceSDK {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.taskHandlers.set(taskName, handler);
    return this; // For chaining
  }

  /**
   * Register a function handler (legacy API, kept for compatibility)
   * @param {string} functionName Name of the function to handle
   * @param {Function} handler Function to call
   * @deprecated Use onTask instead
   */
  registerFunction(functionName: string, handler: TaskHandler): SwarmServiceSDK {
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
    
    // Create a notification function for the task
    const notifyProgress = (
      message: string, 
      data: Record<string, any> = {}, 
      type: ServiceNotificationType = 'progress'
    ): void => {
      this.sendTaskNotification(taskId, message, type, data);
    };
    
    try {
      // Check if there's a handler for this function
      const handler = this.taskHandlers.get(functionName);
      
      if (!handler) {
        const errorMessage = `No handler registered for function: ${functionName}`;
        this.sendTaskNotification(taskId, errorMessage, 'error');
        this.sendTaskResult(taskId, { error: errorMessage });
        return;
      }
      
      // Send an initial progress notification
      notifyProgress(`Starting execution of ${functionName}`, {}, 'info');
      
      // Add the notification function to the parameters so the handler can use it
      const params = {
        ...content.params,
        notifyProgress
      };
      
      // Pass along metadata for context
      const metadata = content.metadata || {};
      
      // Execute the handler
      const result = await handler(params, message);
      
      // Send the result back
      this.sendTaskResult(taskId, result);
      
      // Send a completion notification
      notifyProgress(`Completed execution of ${functionName}`, {
        result: typeof result === 'object' ? { success: true } : { success: true, result }
      }, 'info');
    } catch (error) {
      // Handle errors
      const err = error as Error;
      this.logger.error(`Error executing service task ${functionName}:`, err);
      
      // Send error notification
      this.sendTaskNotification(taskId, `Error executing ${functionName}: ${err.message}`, 'error', {
        error: err.message,
        stack: err.stack
      });
      
      // Send error result
      this.sendTaskResult(taskId, {
        error: err.message,
        stack: err.stack
      });
    }
  }

  /**
   * Send a task result back to the orchestrator
   * @param {string} taskId ID of the task
   * @param {any} result Result data
   */
  sendTaskResult(taskId: string, result: any): void {
    // Ensure result is an object
    const resultObj = typeof result === 'object' ? result : { result };
    
    // Convert errors to a standard format
    if (result instanceof Error) {
      resultObj.error = result.message;
      resultObj.stack = result.stack;
      delete resultObj.result;
    }
    
    // Send the result message
    this.send({
      id: uuidv4(),
      type: 'service.task.result',
      taskId,
      content: resultObj
    } as BaseMessage);
  }

  /**
   * Send a task notification
   * @param {string} taskId ID of the task
   * @param {string} message Notification message
   * @param {ServiceNotificationType} notificationType Type of notification
   * @param {any} data Additional data
   */
  async sendTaskNotification(
    taskId: string, 
    message: string, 
    notificationType: ServiceNotificationType = 'info', 
    data: any = {}
  ): Promise<void> {
    const notification: BaseMessage = {
      id: uuidv4(),
      type: 'service.task.notification',
      content: {
        taskId,
        notificationType,
        message,
        data,
        level: notificationType as 'info' | 'warning' | 'error' | 'debug',
        timestamp: new Date().toISOString()
      }
    };
    
    try {
      await this.send(notification);
    } catch (error) {
      this.logger.error('Error sending task notification:', error);
    }
  }

  /**
   * Send a notification (legacy API)
   * @param {any} notification Notification data
   * @deprecated Use sendTaskNotification instead
   */
  async notify(notification: any): Promise<void> {
    if (!notification.taskId) {
      throw new Error('taskId is required for notifications');
    }
    
    const taskId = notification.taskId;
    const message = notification.message || 'Service notification';
    const type = notification.type || 'info';
    
    // Remove taskId, message, and type so they don't get duplicated
    const data = { ...notification };
    delete data.taskId;
    delete data.message;
    delete data.type;
    
    return this.sendTaskNotification(taskId, message, type as ServiceNotificationType, data);
  }

  /**
   * Send a notification (alias of notify for backward compatibility)
   * @param {any} notification Notification data
   * @deprecated Use sendTaskNotification instead
   */
  async sendNotification(notification: any): Promise<void> {
    return this.notify(notification);
  }

  /**
   * Send a message to the orchestrator
   * @param {BaseMessage} message Message to send
   */
  send(message: BaseMessage): Promise<BaseMessage> {
    if (!this.connected || !this.ws) {
      return Promise.reject(new Error('Not connected to orchestrator'));
    }
    
    // Ensure message has an ID
    if (!message.id) {
      message.id = uuidv4();
    }
    
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Convert message to string
    const messageString = JSON.stringify(message);
    
    // Send to orchestrator
    return new Promise<BaseMessage>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('Not connected to orchestrator'));
        return;
      }
      
      this.ws.send(messageString, (error) => {
        if (error) {
          reject(error);
          return;
        }
        
        // For messages that don't expect a response
        if (!['service.register'].includes(message.type)) {
          resolve(message);
        }
      });
    });
  }

  /**
   * Send a message and wait for a response
   * @param {BaseMessage} message Message to send
   * @param {number} timeout Timeout in milliseconds
   */
  sendAndWaitForResponse(message: BaseMessage, timeout = 30000): Promise<BaseMessage> {
    if (!this.connected || !this.ws) {
      return Promise.reject(new Error('Not connected to orchestrator'));
    }
    
    // Ensure message has an ID
    if (!message.id) {
      message.id = uuidv4();
    }
    
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Convert message to string
    const messageString = JSON.stringify(message);
    
    return new Promise<BaseMessage>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('Not connected to orchestrator'));
        return;
      }
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (this.pendingResponses.has(message.id)) {
          this.pendingResponses.delete(message.id);
          reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
        }
      }, timeout);
      
      // Store the promise handlers
      this.pendingResponses.set(message.id, { 
        resolve, 
        reject, 
        timeout: timeoutId 
      });
      
      // Send the message
      this.ws.send(messageString, (error) => {
        if (error) {
          clearTimeout(timeoutId);
          this.pendingResponses.delete(message.id);
          reject(error);
        }
      });
    });
  }

  /**
   * Set service status
   * @param {ServiceStatus} status New status
   * @param {string} message Optional status message
   */
  async setStatus(status: ServiceStatus, message = ''): Promise<void> {
    const statusMessage: BaseMessage = {
      id: uuidv4(),
      type: 'service.status.update',
      content: {
        status,
        message
      }
    };
    
    await this.send(statusMessage);
  }
}

export { SwarmServiceSDK };
export default SwarmServiceSDK; 