/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
const WebSocket = require('ws');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class SwarmServiceSDK extends EventEmitter {
  constructor(config = {}) {
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
    
    // Set up basic logger
    this.logger = config.logger || console;
  }

  /**
   * Connect to the orchestrator
   * @returns {Promise} Resolves when connected
   */
  connect() {
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
          })
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
            const message = JSON.parse(data);
            this.handleMessage(message);
          } catch (err) {
            this.emit('error', new Error(`Failed to parse message: ${err.message}`));
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
  disconnect() {
    if (this.ws) {
      this.autoReconnect = false;
      this.ws.close();
    }
    return this;
  }

  /**
   * Handle incoming messages
   * @param {Object} message The message to handle
   */
  handleMessage(message) {
    this.emit('message', message);
    
    if (message.requestId && this.pendingResponses.has(message.requestId)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.requestId);
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
      this.handleServiceTask(message);
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
        this.send({ type: 'pong', id: message.id });
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
  onTask(taskName, handler) {
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
  registerFunction(functionName, handler) {
    return this.onTask(functionName, handler);
  }

  /**
   * Handle a service task
   * @param {Object} message - The task message to handle
   * @private
   */
  async handleServiceTask(message) {
    this.logger.debug?.(`[ServiceSDK] Handling service task: ${JSON.stringify(message)}`);
    
    if (!message.id) {
      this.logger.error(`[ServiceSDK] Task message has no ID: ${JSON.stringify(message)}`);
      return;
    }
    
    const taskId = message.id;
    
    try {
      // Extract task content
      const taskData = message.content || {};
      
      // Get function name
      const functionName = taskData.functionName;
      
      if (!functionName) {
        throw new Error('Function name is required');
      }
      
      this.logger.debug?.(`[ServiceSDK] Task ID: ${taskId}, Function: ${functionName}`);
      
      // Get parameters
      const params = taskData.params || {};
      
      // Get metadata
      const metadata = {
        taskId,
        timestamp: new Date().toISOString(),
        agentId: taskData.metadata ? taskData.metadata.agentId : undefined,
        clientId: taskData.metadata ? taskData.metadata.clientId : undefined
      };
      
      // Emit task event
      this.emit('task', { taskId, functionName, params, metadata });
      
      // Find the function handler
      const handler = this.taskHandlers.get(functionName);
      
      if (!handler) {
        throw new Error(`Task '${functionName}' not implemented by this service`);
      }
      
      try {
        // Send a notification that task is starting
        await this.notify({
          taskId,
          type: 'progress',
          message: `Starting execution of ${functionName}`,
          data: { progress: 0 }
        });
        
        // Execute handler and pass a notification function for progress updates
        const notifyProgress = (message, data = {}, type = 'progress') => {
          return this.notify({
            taskId,
            type,
            message,
            data
          });
        };
        
        // Execute the function
        const result = await handler(params, notifyProgress, metadata);
        
        // Send task result
        this.sendTaskResult(taskId, result);
      } catch (error) {
        // Send error notification
        await this.notify({
          taskId,
          type: 'error',
          message: `Error executing ${functionName}: ${error.message}`,
          level: 'error'
        });
        
        // Send task error
        this.sendTaskResult(taskId, { error: error.message });
      }
    } catch (error) {
      this.logger.error(`[ServiceSDK] Error processing task: ${error.message}`, error);
      this.sendTaskResult(taskId, { error: `Error processing task: ${error.message}` });
    }
  }

  /**
   * Send a task result back to the orchestrator
   * @param {string} taskId - The ID of the task
   * @param {Object} result - The task result
   */
  sendTaskResult(taskId, result) {
    this.logger.debug?.(`[ServiceSDK] Sending task result for task ID: ${taskId}`);
    
    if (!this.connected) {
      this.logger.error(`[ServiceSDK] Not connected, cannot send task result for task ID: ${taskId}`);
      return;
    }
    
    if (!taskId) {
      this.logger.error(`[ServiceSDK] Task ID is required to send task result`);
      return;
    }
    
    // Normalize the result if it's just an error string
    if (typeof result === 'string' && result.toLowerCase().includes('error')) {
      result = { error: result };
    }
    
    // Create the task result message
    const message = {
      type: 'service.task.result',
      taskId: taskId,
      content: result
    };
    
    this.logger.debug?.(`[ServiceSDK] Sending task result message: ${JSON.stringify(message)}`);
    
    // Send the message
    try {
      this.ws.send(JSON.stringify(message));
      this.emit('task-result-sent', taskId, result);
    } catch (error) {
      this.logger.error(`[ServiceSDK] Error sending task result: ${error.message}`, error);
      this.emit('error', new Error(`Failed to send task result: ${error.message}`));
    }
  }

  /**
   * Send a notification about task progress or information
   * @param {Object} notification - Notification data
   * @param {string} notification.taskId - ID of the task this notification is related to
   * @param {string} notification.type - Type of notification (progress, info, warning, error, debug)
   * @param {string} notification.message - Notification message
   * @param {Object} notification.data - Additional notification data (optional)
   * @param {string} notification.level - Notification level (info, warning, error, debug) (optional)
   * @returns {Promise<Boolean>} True if notification was sent successfully
   */
  async notify(notification) {
    if (!notification.taskId) {
      throw new Error('Task ID is required for notifications');
    }
    
    if (!notification.type) {
      throw new Error('Notification type is required');
    }
    
    if (!notification.message) {
      throw new Error('Notification message is required');
    }
    
    const message = {
      type: 'service.task.notification',
      content: {
        taskId: notification.taskId,
        notificationType: notification.type,
        message: notification.message,
        data: notification.data || {},
        level: notification.level || 'info',
        timestamp: new Date().toISOString()
      }
    };
    
    try {
      await this.send(message);
      return true;
    } catch (error) {
      this.emit('error', new Error(`Failed to send notification: ${error.message}`));
      return false;
    }
  }

  /**
   * Send a notification about task progress (legacy API, kept for compatibility)
   * @param {Object} notification - Notification data
   * @returns {Promise<Boolean>} True if notification was sent successfully
   * @deprecated Use notify instead
   */
  async sendNotification(notification) {
    return this.notify({
      taskId: notification.taskId,
      type: notification.notificationType,
      message: notification.message,
      data: notification.data,
      level: notification.level
    });
  }

  /**
   * Send a message to the orchestrator
   * @param {Object} message Message to send
   * @returns {Promise} Resolves with the sent message
   */
  send(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to orchestrator'));
      }
      
      try {
        // Add message ID if not present
        if (!message.id) {
          message.id = uuidv4();
        }
        
        this.ws.send(JSON.stringify(message), (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(message);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message and wait for a response
   * @param {Object} message Message to send
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise} Resolves with the response
   */
  sendAndWaitForResponse(message, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to orchestrator'));
      }
      
      try {
        // Add message ID if not present
        if (!message.id) {
          message.id = uuidv4();
        }
        
        const timeoutId = setTimeout(() => {
          if (this.pendingResponses.has(message.id)) {
            this.pendingResponses.delete(message.id);
            reject(new Error(`Request timed out after ${timeout}ms`));
          }
        }, timeout);
        
        this.pendingResponses.set(message.id, {
          resolve,
          reject,
          timeout: timeoutId
        });
        
        this.ws.send(JSON.stringify(message), (err) => {
          if (err) {
            clearTimeout(timeoutId);
            this.pendingResponses.delete(message.id);
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Update service status
   * @param {string} status New status value ('online', 'busy', 'offline', etc.)
   * @param {string} message Optional message explaining the status
   * @returns {Promise<Object>} Status update result
   */
  async setStatus(status, message = '') {
    return this.send({
      type: 'service.status.update',
      content: {
        status,
        message
      }
    });
  }
}

module.exports = SwarmServiceSDK; 