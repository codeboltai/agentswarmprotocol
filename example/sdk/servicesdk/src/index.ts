/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, ServiceStatus } from '@agentswarmprotocol/types/common';
import { 
  ServiceConfig, 
  TaskHandler as TaskHandlerType,
  ServiceTaskExecuteMessage,
  ServiceNotificationType
} from './core/types';
import { WebSocketManager } from './core/WebSocketManager';
import { MessageHandler } from './handlers/MessageHandler';
import { TaskHandler } from './handlers/TaskHandler';
import { NotificationManager } from './services/NotificationManager';
import { StatusManager } from './services/StatusManager';

class SwarmServiceSDK extends EventEmitter {
  // Core properties
  protected serviceId: string;
  protected name: string;
  protected capabilities: string[];
  protected description: string;
  protected manifest: Record<string, any>;
  protected logger: Console;

  // Module instances
  private webSocketManager: WebSocketManager;
  private messageHandler: MessageHandler;
  private taskHandler: TaskHandler;
  private notificationManager: NotificationManager;
  private statusManager: StatusManager;

  constructor(config: ServiceConfig = {}) {
    super();
    
    // Initialize properties
    this.serviceId = config.serviceId || uuidv4();
    this.name = config.name || 'Generic Service';
    this.capabilities = config.capabilities || [];
    this.description = config.description || 'Generic Service';
    this.manifest = config.manifest || {};
    this.logger = config.logger || console;
    
    // Initialize modules
    this.webSocketManager = new WebSocketManager(
      config.orchestratorUrl || 'ws://localhost:3002',
      config.autoReconnect !== false,
      config.reconnectInterval || 5000,
      this.logger
    );
    
    this.messageHandler = new MessageHandler(this.webSocketManager, this.logger);
    this.taskHandler = new TaskHandler(this.webSocketManager, this.serviceId, this.logger);
    this.notificationManager = new NotificationManager(this.webSocketManager, this.serviceId, this.logger);
    this.statusManager = new StatusManager(this.webSocketManager, this.serviceId, this.logger);
    
    // Set up event forwarding
    this.setupEventForwarding();
    
    // Handle special case for task execution messages
    this.messageHandler.on('service.task.execute', (content, message) => {
      this.taskHandler.handleServiceTask(message as ServiceTaskExecuteMessage);
    });

    // Forward task notification events
    this.taskHandler.on('notification', (notification) => {
      this.emit('notification', notification);
    });
  }

  /**
   * Set up event forwarding from the modules to this SDK instance
   */
  private setupEventForwarding() {
    // Forward WebSocketManager events
    this.webSocketManager.on('connected', () => {
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
    });
    
    this.webSocketManager.on('disconnected', () => this.emit('disconnected'));
    this.webSocketManager.on('error', (error) => this.emit('error', error));
    
    // Forward MessageHandler events
    this.messageHandler.on('welcome', (content) => this.emit('welcome', content));
    this.messageHandler.on('registered', (content) => this.emit('registered', content));
    this.messageHandler.on('notification-received', (content) => this.emit('notification-received', content));
  }

  /**
   * Connect to the orchestrator
   * @returns {Promise} Resolves when connected
   */
  connect(): Promise<SwarmServiceSDK> {
    return this.webSocketManager.connect().then(() => this);
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): SwarmServiceSDK {
    this.webSocketManager.disconnect();
    return this;
  }

  /**
   * Register a task handler (new API style)
   * @param {string} taskName Name of the task to handle
   * @param {Function} handler Function to call
   */
  onTask(taskName: string, handler: TaskHandlerType): SwarmServiceSDK {
    this.taskHandler.onTask(taskName, handler);
    return this;
  }

  /**
   * Register a function handler (legacy API, kept for compatibility)
   * @param {string} functionName Name of the function to handle
   * @param {Function} handler Function to call
   * @deprecated Use onTask instead
   */
  registerFunction(functionName: string, handler: TaskHandlerType): SwarmServiceSDK {
    return this.onTask(functionName, handler);
  }

  /**
   * Handle incoming messages (exposed mainly for testing)
   * @param {BaseMessage} message The message to handle
   */
  handleMessage(message: BaseMessage): void {
    this.messageHandler.handleMessage(message);
  }

  /**
   * Send a task result back to the orchestrator
   * @param taskId ID of the task
   * @param result Result data
   */
  sendTaskResult(taskId: string, result: any): void {
    this.taskHandler.sendTaskResult(taskId, result);
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
    await this.taskHandler.sendTaskNotification(taskId, message, notificationType, data);
  }

  /**
   * Send a general notification to clients
   * @param notification Notification data
   */
  async notify(notification: any): Promise<void> {
    await this.notificationManager.notify(notification);
  }

  /**
   * Send a notification to the orchestrator
   * @param notification Notification data
   */
  async sendNotification(notification: any): Promise<void> {
    await this.notificationManager.sendNotification(notification);
  }

  /**
   * Send a message to the orchestrator
   * @param message Message to send
   */
  send(message: BaseMessage): Promise<BaseMessage> {
    return this.webSocketManager.send(message);
  }

  /**
   * Send a message and wait for a response
   * @param message Message to send
   * @param timeout Timeout in milliseconds
   */
  sendAndWaitForResponse(message: BaseMessage, timeout = 30000): Promise<BaseMessage> {
    return this.webSocketManager.sendAndWaitForResponse(message, timeout);
  }

  /**
   * Set service status
   * @param status New status
   * @param message Status message
   */
  async setStatus(status: ServiceStatus, message = ''): Promise<void> {
    await this.statusManager.setStatus(status, message);
  }
}

export { SwarmServiceSDK };
export default SwarmServiceSDK; 