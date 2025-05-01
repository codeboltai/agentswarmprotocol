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
    this.name = config.name || 'Generic Agent';
    this.agentType = config.agentType || 'generic';
    this.capabilities = config.capabilities || [];
    this.description = config.description || 'Generic Agent';
    this.manifest = config.manifest || {};
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
    this.requestService = this.requestService.bind(this);
    this.requestMCPService = this.requestMCPService.bind(this);
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
            content: {
              name: this.name,
              capabilities: this.capabilities,
              manifest: this.manifest
            }
          })
          .then(response => {
            // Store the assigned agent ID if provided
            if (response && response.content && response.content.agentId) {
              this.agentId = response.content.agentId;
            }
            this.emit('registered', response.content);
          })
          .catch(err => {
            this.emit('error', new Error(`Failed to register: ${err.message}`));
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

    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
        
      case 'task.execute':
        this.handleTask(message);
        break;
        
      case 'agent.request.accepted':
        this.emit('agent-request-accepted', message.content);
        break;
        
      case 'agent.response':
        // Handle response from another agent
        this.emit('agent-response', message.content);
        break;
        
      case 'agent.registered':
        // Agent registration confirmed
        this.emit('registered', message.content);
        break;
        
      case 'service.response':
        // Service response received
        this.emit('service-response', message.content);
        break;
        
      case 'ping':
        this.send({ type: 'pong', id: message.id });
        break;
        
      case 'error':
        this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
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
    return this; // For chaining
  }
  
  /**
   * Register a default task handler for any task type not specifically registered
   * @param {Function} handler Default handler function
   */
  registerDefaultTaskHandler(handler) {
    this.taskHandlers.set('default', handler);
    return this; // For chaining
  }

  /**
   * Handle a task message
   * @param {Object} message - The task message to handle
   * @private
   */
  async handleTask(message) {
    console.log(`[SDK] Handling task message: ${JSON.stringify(message)}`);
    
    if (!message.id) {
      console.error(`[SDK] Task message has no ID: ${JSON.stringify(message)}`);
      return;
    }
    
    const taskId = message.id;
    
    try {
      // Extract task content
      const taskData = message.content || {};
      
      // Get taskType with fallback options
      // First try direct taskType field, then try from input if available
      const taskType = taskData.taskType || (taskData.input && taskData.input.taskType);
      
      console.log(`[SDK] Task ID: ${taskId}, Type: ${taskType || 'unknown'}, Raw taskData:`, JSON.stringify(taskData));
      
      // Get metadata
      const metadata = {
        taskId,
        timestamp: new Date().toISOString(),
        clientId: taskData.metadata ? taskData.metadata.clientId : 'unknown'
      };
      
      this.emit('task', { taskId, taskData, metadata });
      
      console.log(`[SDK] Finding handler for task type: ${taskType || 'unknown'}`);
      
      // Find the task handler
      let handler = null;
      if (taskType && this.taskHandlers.has(taskType)) {
        console.log(`[SDK] Using specific handler for task type: ${taskType}`);
        handler = this.taskHandlers.get(taskType);
      } else if (this.taskHandlers.has('default')) {
        console.log(`[SDK] Using default handler for task type: ${taskType || 'unknown'}`);
        handler = this.taskHandlers.get('default');
      } else {
        console.error(`[SDK] No handler found for task type: ${taskType || 'unknown'}`);
        this.sendTaskResult(taskId, {
          error: `Task type '${taskType || 'unknown'}' not supported by this agent`
        });
        return;
      }
      
      try {
        // Execute handler
        console.log(`[SDK] Executing handler for task ID: ${taskId}`);
        const result = await handler(taskData, metadata);
        console.log(`[SDK] Handler execution completed for task ID: ${taskId}`);
        console.log(`[SDK] Result type: ${typeof result}, Is null: ${result === null}, Is undefined: ${result === undefined}`);
        
        if (result !== undefined) {
          console.log(`[SDK] Sending result for task ID: ${taskId}`);
          console.log(`[SDK] Result: ${JSON.stringify(result)}`);
          this.sendTaskResult(taskId, result);
        } else {
          console.warn(`[SDK] Handler returned undefined for task ID: ${taskId}`);
          this.sendTaskResult(taskId, { message: 'Task processed but no result returned' });
        }
      } catch (error) {
        console.error(`[SDK] Error executing handler for task ID: ${taskId}`, error);
        this.sendTaskResult(taskId, { error: error.message });
      }
    } catch (error) {
      console.error(`[SDK] Error processing task: ${error.message}`, error);
      this.sendTaskResult(taskId, { error: `Error processing task: ${error.message}` });
    }
  }

  /**
   * Send a task result back to the orchestrator
   * @param {string} taskId - The ID of the task
   * @param {Object} result - The task result
   */
  sendTaskResult(taskId, result) {
    console.log(`[SDK] Sending task result for task ID: ${taskId}`);
    console.log(`[SDK] Result: ${JSON.stringify(result)}`);
    
    if (!this.connected) {
      console.error(`[SDK] Not connected, cannot send task result for task ID: ${taskId}`);
      return;
    }
    
    if (!taskId) {
      console.error(`[SDK] Task ID is required to send task result`);
      return;
    }
    
    // Normalize the result if it's just an error string
    if (typeof result === 'string' && result.toLowerCase().includes('error')) {
      result = { error: result };
    }
    
    // Create the task result message
    const message = {
      type: 'task.result',
      requestId: taskId, // Keep for backward compatibility
      taskId: taskId, // Add taskId for compatibility with different orchestrator versions
      content: result
    };
    
    console.log(`[SDK] Sending task result message: ${JSON.stringify(message)}`);
    
    // Send the message
    try {
      this.ws.send(JSON.stringify(message));
      this.emit('task-sent', taskId, result);
    } catch (error) {
      console.error(`[SDK] Error sending task result: ${error.message}`, error);
      this.emit('error', new Error(`Failed to send task result: ${error.message}`));
    }
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
  
  /**
   * Request a service from the orchestrator
   * @param {string} serviceName Name of the service
   * @param {Object} params Parameters for the service
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Object>} Service response
   */
  async requestService(serviceName, params = {}, timeout = 30000) {
    const message = {
      type: 'service.request',
      content: {
        service: serviceName,
        params
      }
    };
    
    try {
      const response = await this.sendAndWaitForResponse(message, timeout);
      return response.content;
    } catch (error) {
      this.emit('error', new Error(`Failed to request service ${serviceName}: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Request an MCP service from the orchestrator
   * @param {Object} params MCP service parameters
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Object>} MCP service response
   */
  async requestMCPService(params = {}, timeout = 30000) {
    return this.requestService('mcp-service', params, timeout);
  }
  
  /**
   * Get information about all available agents
   * @param {Object} filters Optional filters
   * @returns {Promise<Array>} List of agents
   */
  async getAgentList(filters = {}) {
    const response = await this.requestService('agent-list', { filters });
    return response.agents || [];
  }
  
  /**
   * Set the agent's status
   * @param {string} status New status value
   * @returns {Promise<Object>} Status update result
   */
  async setStatus(status) {
    return this.requestService('agent-status-update', { status });
  }
}

module.exports = SwarmAgentSDK; 