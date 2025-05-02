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
    this.messageHandlers = new Map();
    this.taskHandlers = new Map(); // Keep for backward compatibility
    
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

    // Handle task.execute specially to extract the task type
    if (message.type === 'task.execute') {
      this.handleTask(message);
      return;
    }

    // Emit for the specific message type
    this.emit(message.type, message.content, message);

    // For standard message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
        
      case 'agent.request.accepted':
        this.emit('agent-request-accepted', message.content);
        break;
        
      case 'agent.response':
        this.emit('agent-response', message.content);
        break;
        
      case 'agent.registered':
        this.emit('registered', message.content);
        break;
        
      case 'service.response':
        this.emit('service-response', message.content);
        break;
        
      case 'ping':
        this.send({ type: 'pong', id: message.id });
        break;
        
      case 'error':
        this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
        break;
        
      // New MCP message types
      case 'mcp.servers.list':
        this.emit('mcp-servers-list', message.content);
        break;
        
      case 'mcp.tools.list':
        this.emit('mcp-tools-list', message.content);
        break;
        
      case 'mcp.tool.execution.result':
        this.emit('mcp-tool-execution-result', message.content);
        break;
    }
  }

  /**
   * Register a message handler for a specific message type
   * New simplified API for message handling
   * @param {string} messageType Type of message to handle
   * @param {Function} handler Function to call when message is received
   */
  onMessage(messageType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.messageHandlers.set(messageType, handler);
    return this; // For chaining
  }

  /**
   * Execute a service and return the result
   * @param {string} serviceName Name of the service to execute
   * @param {Object} params Parameters for the service
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise} Promise that resolves with the service result
   */
  async executeService(serviceName, params = {}, timeout = 30000) {
    return this.requestService(serviceName, params, timeout);
  }

  /**
   * Send a message response for a task
   * @param {string} taskId ID of the task
   * @param {Object} content Content of the message
   */
  sendMessage(taskId, content) {
    return this.sendTaskResult(taskId, content);
  }

  /**
   * Register a task handler for a specific task type
   * Maintained for backward compatibility
   * @param {string} taskType Type of task to handle
   * @param {Function} handler Function to call when task is received
   */
  registerTaskHandler(taskType, handler) {
    this.taskHandlers.set(taskType, handler);
    this.messageHandlers.set(taskType, handler); // Also register with the new system
    return this; // For chaining
  }
  
  /**
   * Register a default task handler for any task type not specifically registered
   * Maintained for backward compatibility
   * @param {Function} handler Default handler function
   */
  registerDefaultTaskHandler(handler) {
    this.taskHandlers.set('default', handler);
    this.messageHandlers.set('default', handler); // Also register with the new system
    return this; // For chaining
  }

  /**
   * Handle a task message
   * @param {Object} message - The task message to handle
   * @private
   */
  async handleTask(message) {
    this.logger.debug?.(`[SDK] Handling task message: ${JSON.stringify(message)}`);
    
    if (!message.id) {
      this.logger.error(`[SDK] Task message has no ID: ${JSON.stringify(message)}`);
      return;
    }
    
    const taskId = message.id;
    
    try {
      // Extract task content
      const taskData = message.content || {};
      
      // Get taskType with fallback options
      // First try direct taskType field, then try from input if available
      const taskType = taskData.taskType || (taskData.input && taskData.input.taskType);
      
      this.logger.debug?.(`[SDK] Task ID: ${taskId}, Type: ${taskType || 'unknown'}`);
      
      // Get metadata
      const metadata = {
        taskId,
        timestamp: new Date().toISOString(),
        clientId: taskData.metadata ? taskData.metadata.clientId : 'unknown'
      };
      
      // Emit generic task event
      this.emit('task', { taskId, taskData, metadata });
      
      // Emit specific task type event if available
      if (taskType) {
        const taskEventResponse = this.emit(taskType, taskData, metadata);
        
        // Check if new message handlers were registered for this task type
        if (this.messageHandlers.has(taskType)) {
          try {
            const handler = this.messageHandlers.get(taskType);
            const result = await handler(taskData, metadata);
            if (result !== undefined) {
              this.sendTaskResult(taskId, result);
            }
            return;
          } catch (error) {
            this.logger.error(`[SDK] Error in message handler for ${taskType}: ${error.message}`);
            this.sendTaskResult(taskId, { error: error.message });
            return;
          }
        }
        
        // If a specific task event listener is handling it, we're done
        if (taskEventResponse) {
          return;
        }
      }
      
      // Fall back to task handlers for backward compatibility
      this.logger.debug?.(`[SDK] Finding handler for task type: ${taskType || 'unknown'}`);
      
      // Find the task handler
      let handler = null;
      if (taskType && this.taskHandlers.has(taskType)) {
        this.logger.debug?.(`[SDK] Using specific handler for task type: ${taskType}`);
        handler = this.taskHandlers.get(taskType);
      } else if (this.taskHandlers.has('default')) {
        this.logger.debug?.(`[SDK] Using default handler for task type: ${taskType || 'unknown'}`);
        handler = this.taskHandlers.get('default');
      } else {
        this.logger.error(`[SDK] No handler found for task type: ${taskType || 'unknown'}`);
        this.sendTaskResult(taskId, {
          error: `Task type '${taskType || 'unknown'}' not supported by this agent`
        });
        return;
      }
      
      try {
        // Execute handler
        this.logger.debug?.(`[SDK] Executing handler for task ID: ${taskId}`);
        const result = await handler(taskData, metadata);
        this.logger.debug?.(`[SDK] Handler execution completed for task ID: ${taskId}`);
        
        if (result !== undefined) {
          this.logger.debug?.(`[SDK] Sending result for task ID: ${taskId}`);
          this.sendTaskResult(taskId, result);
        } else {
          this.logger.warn(`[SDK] Handler returned undefined for task ID: ${taskId}`);
          this.sendTaskResult(taskId, { message: 'Task processed but no result returned' });
        }
      } catch (error) {
        this.logger.error(`[SDK] Error executing handler for task ID: ${taskId}`, error);
        this.sendTaskResult(taskId, { error: error.message });
      }
    } catch (error) {
      this.logger.error(`[SDK] Error processing task: ${error.message}`, error);
      this.sendTaskResult(taskId, { error: `Error processing task: ${error.message}` });
    }
  }

  /**
   * Send a task result back to the orchestrator
   * @param {string} taskId - The ID of the task
   * @param {Object} result - The task result
   */
  sendTaskResult(taskId, result) {
    this.logger.debug?.(`[SDK] Sending task result for task ID: ${taskId}`);
    
    if (!this.connected) {
      this.logger.error(`[SDK] Not connected, cannot send task result for task ID: ${taskId}`);
      return;
    }
    
    if (!taskId) {
      this.logger.error(`[SDK] Task ID is required to send task result`);
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
    
    this.logger.debug?.(`[SDK] Sending task result message: ${JSON.stringify(message)}`);
    
    // Send the message
    try {
      this.ws.send(JSON.stringify(message));
      this.emit('task-sent', taskId, result);
    } catch (error) {
      this.logger.error(`[SDK] Error sending task result: ${error.message}`, error);
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
   * Get a list of all available agents in the swarm
   * @param {Object} filters - Optional filters to apply to the agent list
   * @param {string} filters.status - Filter by agent status ('online', 'offline', etc.)
   * @param {Array<string>} filters.capabilities - Filter by agent capabilities
   * @param {string} filters.name - Filter by agent name (partial match)
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

  /**
   * Get a list of available MCP servers
   * @param {Object} filters Optional filters for filtering servers
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Array>} List of available MCP servers
   */
  async getMCPServers(filters = {}, timeout = 30000) {
    const message = {
      type: 'mcp.servers.list.request',
      content: { filters }
    };
    
    try {
      const response = await this.sendAndWaitForResponse(message, timeout);
      return response.content.servers || [];
    } catch (error) {
      this.emit('error', new Error(`Failed to get MCP servers: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Get a list of tools available in an MCP server
   * @param {string} serverId ID of the MCP server
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Array>} List of available tools
   */
  async getMCPTools(serverId, timeout = 30000) {
    const message = {
      type: 'mcp.tools.list.request',
      content: { serverId }
    };
    
    try {
      const response = await this.sendAndWaitForResponse(message, timeout);
      return response.content.tools || [];
    } catch (error) {
      this.emit('error', new Error(`Failed to get MCP tools for server ${serverId}: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Execute an MCP tool
   * @param {string} serverId ID of the MCP server
   * @param {string} toolName Name of the tool to execute
   * @param {Object} parameters Parameters for the tool
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Object>} Tool execution result
   */
  async executeMCPTool(serverId, toolName, parameters = {}, timeout = 60000) {
    const message = {
      type: 'mcp.tool.execute.request',
      content: {
        serverId,
        toolName,
        parameters,
        timeout
      }
    };
    
    try {
      const response = await this.sendAndWaitForResponse(message, timeout);
      
      if (response.content.status === 'error') {
        throw new Error(response.content.error || 'Unknown error executing MCP tool');
      }
      
      return response.content.result;
    } catch (error) {
      this.emit('error', new Error(`Failed to execute MCP tool ${toolName} on server ${serverId}: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Simplified method to execute an MCP tool by name
   * This method will handle looking up the appropriate server if only the tool name is given
   * @param {string} toolName Name of the tool to execute
   * @param {Object} parameters Parameters for the tool
   * @param {string} serverId Optional server ID - if not provided, the first available server with the tool will be used
   * @param {number} timeout Timeout in milliseconds
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, parameters = {}, serverId = null, timeout = 60000) {
    try {
      // If serverId is not provided, find a server that has this tool
      if (!serverId) {
        const servers = await this.getMCPServers();
        
        if (!servers || servers.length === 0) {
          throw new Error('No MCP servers available');
        }
        
        // Try to find a server with this tool
        for (const server of servers) {
          try {
            const tools = await this.getMCPTools(server.id);
            if (tools.some(tool => tool.name === toolName)) {
              serverId = server.id;
              break;
            }
          } catch (err) {
            this.logger.warn(`Could not get tools for server ${server.id}: ${err.message}`);
            // Continue to next server
          }
        }
        
        if (!serverId) {
          throw new Error(`No MCP server found that provides tool: ${toolName}`);
        }
      }
      
      // Execute the tool on the selected server
      return this.executeMCPTool(serverId, toolName, parameters, timeout);
    } catch (error) {
      this.emit('error', new Error(`Failed to execute tool ${toolName}: ${error.message}`));
      throw error;
    }
  }

  /**
   * Ask another agent to execute a task and return the result
   * @param {string} targetAgentName - Name of the agent to execute the task
   * @param {string} taskType - Type of task to execute
   * @param {Object} taskData - Data for the task
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Result from the target agent
   */
  async executeAgentTask(targetAgentName, taskType, taskData = {}, timeout = 30000) {
    if (!targetAgentName) {
      throw new Error('Target agent name is required');
    }
    
    if (!taskType) {
      throw new Error('Task type is required');
    }
    
    const fullTaskData = {
      type: taskType,
      ...taskData
    };
    
    return this.requestService('agent-execute-task', {
      targetAgentName,
      taskData: fullTaskData
    }, timeout);
  }

  /**
   * Register a handler for when another agent asks this agent to execute a task
   * @param {string} taskType - Type of task to handle
   * @param {Function} handler - Function to handle the task
   * @returns {SwarmAgentSDK} - For method chaining
   */
  onAgentRequest(taskType, handler) {
    return this.onMessage(taskType, handler);
  }

  /**
   * Send a task notification to inform clients about task progress or actions
   * @param {Object} notification - Notification data
   * @param {string} notification.taskId - ID of the task this notification is related to (optional)
   * @param {string} notification.notificationType - Type of notification (info, warning, step, progress, etc.)
   * @param {string} notification.message - Notification message text
   * @param {Object} notification.data - Additional notification data (optional)
   * @param {string} notification.level - Notification level: 'info', 'warning', 'error', 'debug' (default: 'info')
   * @param {string} notification.clientId - Specific client ID to send the notification to (optional)
   * @returns {Promise<void>}
   */
  async sendTaskNotification(notification) {
    if (!notification.notificationType) {
      throw new Error('Notification type is required');
    }
    
    if (!notification.message) {
      throw new Error('Notification message is required');
    }
    
    const message = {
      type: 'task.notification',
      content: {
        taskId: notification.taskId,
        notificationType: notification.notificationType,
        message: notification.message,
        data: notification.data || {},
        level: notification.level || 'info',
        clientId: notification.clientId,
        timestamp: notification.timestamp || new Date().toISOString()
      }
    };
    
    try {
      await this.send(message);
      return true;
    } catch (error) {
      this.emit('error', new Error(`Failed to send task notification: ${error.message}`));
      throw error;
    }
  }

  /**
   * Register a notification handler for receiving notifications from the orchestrator
   * @param {Function} handler - Notification handler function
   * @returns {Function} Unsubscribe function to remove the handler
   */
  onNotification(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Notification handler must be a function');
    }
    
    const wrappedHandler = (message) => {
      if (message.type === 'task.notification') {
        handler(message.content);
      }
    };
    
    this.on('message', wrappedHandler);
    
    // Return unsubscribe function
    return () => {
      this.removeListener('message', wrappedHandler);
    };
  }

  /**
   * Execute a service task and receive the result
   * @param {string} serviceId - ID or name of the service to execute the task 
   * @param {string} functionName - Name of the function to call
   * @param {Object} params - Parameters for the function
   * @param {Object} options - Additional options
   * @param {string} options.clientId - Client ID to forward notifications to
   * @param {boolean} options.waitForResult - Whether to wait for the final result
   * @param {Function} options.onNotification - Callback for notifications during task execution
   * @param {number} options.timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Result from the service
   */
  async executeServiceTask(serviceId, functionName, params = {}, options = {}) {
    if (!serviceId) {
      throw new Error('Service ID or name is required');
    }
    
    if (!functionName) {
      throw new Error('Function name is required');
    }
    
    const waitForResult = options.waitForResult !== false;
    const timeout = options.timeout || 60000;
    
    // Create a message to send to the orchestrator
    const message = {
      type: 'service.task.request',
      content: {
        serviceId,
        functionName,
        params,
        clientId: options.clientId,
        async: !waitForResult
      }
    };
    
    try {
      // If a notification handler is provided, set up the listener
      let notificationHandler;
      let notificationListener;
      
      if (typeof options.onNotification === 'function') {
        notificationHandler = options.onNotification;
        
        notificationListener = (msg) => {
          if (msg.type === 'service.notification') {
            notificationHandler(msg.content);
          }
        };
        
        this.on('message', notificationListener);
      }
      
      // Send the request
      const response = await this.sendAndWaitForResponse(message, timeout);
      
      // If not waiting for result, return task info
      if (!waitForResult) {
        if (notificationListener) {
          this.removeListener('message', notificationListener);
        }
        
        return {
          taskId: response.content.taskId,
          status: 'pending'
        };
      }
      
      // If waiting for result, get the task ID and wait for completion
      const taskId = response.content.taskId;
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (notificationListener) {
            this.removeListener('message', notificationListener);
          }
          
          reject(new Error(`Timeout waiting for service task ${taskId} result`));
        }, timeout);
        
        const resultHandler = (message) => {
          if (message.type === 'service.task.result' && message.taskId === taskId) {
            clearTimeout(timeoutId);
            
            if (notificationListener) {
              this.removeListener('message', notificationListener);
            }
            
            this.removeListener('message', resultHandler);
            
            if (message.content && message.content.error) {
              reject(new Error(message.content.error));
            } else {
              resolve(message.content);
            }
          }
        };
        
        this.on('message', resultHandler);
      });
    } catch (error) {
      this.emit('error', new Error(`Failed to execute service task: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Get a list of available services
   * @param {Object} filters - Optional filters for filtering services
   * @param {string} filters.status - Filter by service status
   * @param {Array<string>} filters.capabilities - Filter by service capabilities
   * @param {string} filters.name - Filter by service name
   * @returns {Promise<Array>} List of services
   */
  async getServiceList(filters = {}) {
    const response = await this.requestService('service-list', { filters });
    return response.services || [];
  }
}

module.exports = SwarmAgentSDK; 