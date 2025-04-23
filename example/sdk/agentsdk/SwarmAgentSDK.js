/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class SwarmAgentSDK extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.agentId = config.agentId || uuidv4();
    this.agentType = config.agentType || 'generic';
    this.capabilities = config.capabilities || [];
    this.description = config.description || 'Generic Agent';
    this.orchestratorUrl = config.orchestratorUrl || 'ws://localhost:3000';
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.connected = false;
    this.connecting = false;
    this.pendingResponses = new Map();
    this.taskHandlers = new Map();

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.registerTaskHandler = this.registerTaskHandler.bind(this);
    this.handleTask = this.handleTask.bind(this);
    this.sendTaskResult = this.sendTaskResult.bind(this);
    this.send = this.send.bind(this);
    this.sendAndWaitForResponse = this.sendAndWaitForResponse.bind(this);
    this.requestAgentTask = this.requestAgentTask.bind(this);
  }

  /**
   * Connect to the orchestrator
   * @returns {Promise} Resolves when connected
   */
  connect() {
    if (this.connected || this.connecting) {
      return Promise.resolve();
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.orchestratorUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.connecting = false;
          
          // Register agent with orchestrator
          this.send({
            type: 'agent.register',
            agentId: this.agentId,
            agentType: this.agentType,
            capabilities: this.capabilities,
            description: this.description
          });
          
          this.emit('connected');
          resolve();
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
  }

  /**
   * Handle incoming messages
   * @param {Object} message The message to handle
   */
  handleMessage(message) {
    this.emit('message', message);
    
    if (message.id && this.pendingResponses.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.id);
      clearTimeout(timeout);
      this.pendingResponses.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message);
      }
      return;
    }

    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message);
        break;
        
      case 'task.execute':
        this.handleTask(message);
        break;
        
      case 'agent.response':
        // Handle response from another agent
        this.emit('agent-response', message);
        if (message.requestId && this.pendingResponses.has(message.requestId)) {
          const { resolve } = this.pendingResponses.get(message.requestId);
          resolve(message);
          this.pendingResponses.delete(message.requestId);
        }
        break;
        
      case 'ping':
        this.send({ type: 'pong', id: message.id });
        break;
        
      case 'error':
        this.emit('error', new Error(message.error));
        break;
        
      default:
        this.emit(message.type, message);
    }
  }

  /**
   * Register a task handler for a specific task type
   * @param {string} taskType Type of task to handle
   * @param {Function} handler Function to call when task is received
   */
  registerTaskHandler(taskType, handler) {
    this.taskHandlers.set(taskType, handler);
  }

  /**
   * Handle a task assignment
   * @param {Object} message Task assignment message
   */
  async handleTask(message) {
    const task = message.content;
    this.emit('task', task);
    
    try {
      if (!task || !task.input || !task.input.taskType) {
        throw new Error('Invalid task format');
      }
      
      const taskType = task.input.taskType;
      const handler = this.taskHandlers.get(taskType) || this.taskHandlers.get('default');
      
      if (!handler) {
        throw new Error(`No handler registered for task type: ${taskType}`);
      }
      
      const result = await handler(task.input);
      this.sendTaskResult(message.id, result);
    } catch (error) {
      this.send({
        type: 'task.error',
        requestId: message.id,
        error: error.message
      });
    }
  }

  /**
   * Send a task result back to the orchestrator
   * @param {string} taskId ID of the task
   * @param {Object} result Result of the task
   */
  sendTaskResult(taskId, result) {
    return this.send({
      type: 'task.result',
      requestId: taskId,
      content: result
    });
  }

  /**
   * Send a message to the orchestrator
   * @param {Object} message Message to send
   * @returns {Promise} Resolves when the message is sent
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
   * Request a task from another agent
   * @param {string} targetAgentName Name of the target agent
   * @param {Object} taskData Data to send with the task
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Object>} Response from the target agent
   */
  async requestAgentTask(targetAgentName, taskData, timeout = 30000) {
    const message = {
      type: 'agent.request',
      content: {
        targetAgentName,
        taskData
      }
    };
    
    try {
      const response = await this.sendAndWaitForResponse(message, timeout);
      return response.content;
    } catch (error) {
      this.emit('error', new Error(`Failed to request task from agent ${targetAgentName}: ${error.message}`));
      throw error;
    }
  }
}

module.exports = SwarmAgentSDK; 