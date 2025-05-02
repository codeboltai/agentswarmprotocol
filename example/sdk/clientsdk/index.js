const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

/**
 * SwarmClientSDK - Client SDK for Agent Swarm Protocol
 * Handles client-side communication with the orchestrator
 */
class SwarmClientSDK extends EventEmitter {
  /**
   * Create a new SwarmClientSDK instance
   * @param {Object} config - Configuration options
   * @param {string} config.orchestratorUrl - WebSocket URL of the orchestrator client interface
   * @param {boolean} config.autoReconnect - Whether to automatically reconnect on disconnection
   * @param {number} config.reconnectInterval - Interval in ms to attempt reconnection
   */
  constructor(config = {}) {
    super();
    
    this.orchestratorUrl = config.orchestratorUrl || process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.pendingResponses = new Map();
    this.connected = false;
    this.clientId = null;
  }

  /**
   * Connect to the orchestrator client interface
   * @returns {Promise<void>} Resolves when connected
   */
  async connect() {
    if (this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to orchestrator at ${this.orchestratorUrl}`);
        
        // Create WebSocket connection
        this.ws = new WebSocket(this.orchestratorUrl);
        
        // Set up event listeners
        this.ws.on('open', () => {
          console.log('Connected to orchestrator');
          this.connected = true;
          this.emit('connected');
          resolve();
        });
        
        this.ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data);
            await this.handleMessage(message);
          } catch (error) {
            console.error('Error handling message:', error);
            this.emit('error', error);
          }
        });
        
        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });
        
        this.ws.on('close', () => {
          console.log('Disconnected from orchestrator');
          this.connected = false;
          this.emit('disconnected');
          
          // Attempt to reconnect if enabled
          if (this.autoReconnect) {
            console.log(`Attempting to reconnect in ${this.reconnectInterval / 1000} seconds...`);
            setTimeout(() => this.connect().catch(err => {
              console.error('Reconnection error:', err);
            }), this.reconnectInterval);
          }
        });
      } catch (error) {
        console.error('Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from the orchestrator
   * @param {Object} message - The received message
   */
  async handleMessage(message) {
    console.log(`Client SDK received message: ${JSON.stringify(message)}`);
    
    // Emit the message for custom handlers
    this.emit('message', message);
    
    // Check for pending responses
    if (message.id && this.pendingResponses.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.id);
      clearTimeout(timeout);
      this.pendingResponses.delete(message.id);
      
      if (message.type === 'error' || (message.content && message.content.error)) {
        reject(new Error(message.content ? message.content.error : 'Unknown error'));
      } else {
        resolve(message);
      }
      console.log(`Resolved pending response for message ID: ${message.id}`);
      return;
    }
    
    // Handle specific message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.clientId = message.content.clientId;
        this.emit('welcome', message.content);
        break;
        
      case 'agent.list':
        this.emit('agent-list', message.content.agents);
        break;
        
      case 'mcp.server.list':
        console.log('Emitting mcp-server-list event with servers:', JSON.stringify(message.content.servers));
        this.emit('mcp-server-list', message.content.servers);
        break;
        
      case 'task.result':
        this.emit('task-result', message.content);
        break;
        
      case 'task.status':
        this.emit('task-status', message.content);
        break;
        
      case 'task.created':
        this.emit('task-created', message.content);
        break;
        
      case 'task.notification':
        // Handle task notifications
        console.log(`Received task notification: ${message.content.message} (${message.content.notificationType})`);
        this.emit('task-notification', message.content);
        break;
        
      case 'error':
        console.error(`Received error: ${message.content ? message.content.error : 'Unknown error'}`);
        this.emit('orchestrator-error', message.content || { error: 'Unknown error' });
        break;
        
      default:
        console.log(`Unhandled message type: ${message.type}`);
        break;
    }
  }

  /**
   * Send a message to the orchestrator
   * @param {Object} message - The message to send
   * @returns {Promise<string|null>} - The message ID or null if not sent
   */
  async send(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to orchestrator'));
      }
      
      try {
        // Add message ID if not present
        if (!message.id) {
          message.id = uuidv4();
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message), (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(message.id);
            }
          });
        } else {
          reject(new Error('WebSocket not open, cannot send message'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message and wait for a response
   * @param {Object} message - The message to send
   * @param {Object} options - Additional options
   * @param {number} options.timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - The response message
   */
  sendAndWaitForResponse(message, options = {}) {
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    return new Promise((resolve, reject) => {
      this.send(message)
        .then(messageId => {
          // Set timeout
          const timeoutId = setTimeout(() => {
            if (this.pendingResponses.has(messageId)) {
              this.pendingResponses.delete(messageId);
              reject(new Error(`Timeout waiting for response to message ${messageId}`));
            }
          }, timeout);
          
          // Response callback
          this.pendingResponses.set(messageId, {
            resolve,
            reject,
            timeout: timeoutId
          });
        })
        .catch(reject);
    });
  }

  /**
   * Get a list of all registered agents
   * @param {Object} filters - Optional filters to apply to the agent list
   * @returns {Promise<Array>} - Array of agent objects
   */
  async getAgents(filters = {}) {
    const response = await this.sendAndWaitForResponse({
      type: 'agent.list',
      content: { filters }
    });
    
    return response.content.agents;
  }

  /**
   * Send a task to an agent
   * @param {string} agentName - Name of the agent to send the task to
   * @param {Object} taskData - Task data to send
   * @param {Object} options - Additional options
   * @param {boolean} options.waitForResult - Whether to wait for the task result
   * @param {number} options.timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Task information
   */
  async sendTask(agentName, taskData, options = {}) {
    const waitForResult = options.waitForResult !== false;
    const timeout = options.timeout || 60000; // Default 60 second timeout
    
    const response = await this.sendAndWaitForResponse({
      type: 'task.create',
      content: {
        agentName,
        taskData
      }
    });
    
    const taskId = response.content.taskId;
    
    if (!waitForResult) {
      return {
        taskId,
        status: 'pending'
      };
    }
    
    // Wait for task result
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for task ${taskId} result`));
      }, timeout);
      
      const resultHandler = (content) => {
        if (content.taskId === taskId) {
          clearTimeout(timeoutId);
          this.removeListener('task-result', resultHandler);
          resolve({
            taskId,
            status: 'completed',
            result: content.result
          });
        }
      };
      
      const errorHandler = (content) => {
        if (content.taskId === taskId) {
          clearTimeout(timeoutId);
          this.removeListener('orchestrator-error', errorHandler);
          reject(new Error(content.error || 'Task failed'));
        }
      };
      
      this.on('task-result', resultHandler);
      this.on('orchestrator-error', errorHandler);
    });
  }

  /**
   * Get the status of a task
   * @param {string} taskId - ID of the task
   * @returns {Promise<Object>} - Task status
   */
  async getTaskStatus(taskId) {
    const response = await this.sendAndWaitForResponse({
      type: 'task.status',
      content: {
        taskId
      }
    });
    
    return response.content;
  }

  /**
   * List available MCP servers
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - List of MCP servers
   */
  async listMCPServers(filters = {}) {
    const response = await this.sendAndWaitForResponse({
      type: 'mcp.server.list',
      content: { filters }
    });
    
    return response.content.servers;
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect() {
    if (this.ws) {
      this.autoReconnect = false; // Disable reconnection
      this.ws.close();
      console.log('Disconnected from orchestrator');
    }
  }

  /**
   * Subscribe to task notifications
   * @param {Object} options - Subscription options
   * @param {string} options.taskId - Filter notifications for specific task (optional)
   * @param {string} options.agentId - Filter notifications from specific agent (optional)
   * @param {string} options.notificationType - Filter notifications by type (optional)
   * @param {Function} callback - Callback function that receives notifications
   * @returns {Function} Function to unsubscribe from notifications
   */
  subscribeToNotifications(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const handler = (notification) => {
      // Apply filters if provided
      if (options.taskId && notification.taskId !== options.taskId) {
        return; // Skip if task ID doesn't match
      }
      
      if (options.agentId && notification.agentId !== options.agentId) {
        return; // Skip if agent ID doesn't match
      }
      
      if (options.notificationType && notification.notificationType !== options.notificationType) {
        return; // Skip if notification type doesn't match
      }
      
      // Call the callback with the notification
      callback(notification);
    };
    
    // Register the handler
    this.on('task-notification', handler);
    
    // Return unsubscribe function
    return () => {
      this.removeListener('task-notification', handler);
    };
  }
}

module.exports = SwarmClientSDK; 