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
    this.pendingResponses = {};
    this.connected = false;
    this.clientId = null;
  }

  /**
   * Connect to the orchestrator client interface
   * @returns {Promise<void>} Resolves when connected
   */
  async connect() {
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
        });
        
        this.ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data);
            await this.handleMessage(message);
            
            // If this is the welcome message, complete the connection promise
            if (message.type === 'orchestrator.welcome') {
              resolve();
            }
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
            setTimeout(() => this.connect(), this.reconnectInterval);
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
    // Emit the message for custom handlers
    this.emit('message', message);
    
    // Handle specific message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.clientId = message.content.clientId;
        this.emit('welcome', message.content);
        break;
        
      case 'agent.list':
        this.emit('agent-list', message.content.agents);
        this.resolveResponse(message);
        break;
        
      case 'task.result':
        this.emit('task-result', message.content);
        this.resolveResponse(message);
        break;
        
      case 'task.status':
        this.emit('task-status', message.content);
        this.resolveResponse(message);
        break;
        
      case 'error':
        console.error(`Received error: ${message.content.error}`);
        this.emit('orchestrator-error', message.content);
        this.resolveResponse(message, new Error(message.content.error));
        break;
    }
  }

  /**
   * Resolve a pending response
   * @param {Object} message - Response message
   * @param {Error} [error] - Optional error
   * @private
   */
  resolveResponse(message, error = null) {
    const messageId = message.id;
    
    if (messageId && this.pendingResponses[messageId]) {
      if (error) {
        this.pendingResponses[messageId].reject(error);
      } else {
        this.pendingResponses[messageId].resolve(message);
      }
      
      delete this.pendingResponses[messageId];
    }
  }

  /**
   * Send a message to the orchestrator
   * @param {Object} message - The message to send
   * @returns {string|null} - The message ID or null if not sent
   */
  send(message) {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return message.id;
    } else {
      console.error('WebSocket not open, cannot send message');
      return null;
    }
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
      const messageId = this.send(message);
      
      if (!messageId) {
        return reject(new Error('Failed to send message'));
      }
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        delete this.pendingResponses[messageId];
        reject(new Error(`Timeout waiting for response to message ${messageId}`));
      }, timeout);
      
      // Response callback
      this.pendingResponses[messageId] = {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      };
    });
  }

  /**
   * Get a list of all registered agents
   * @returns {Promise<Array>} - Array of agent objects
   */
  async getAgents() {
    const response = await this.sendAndWaitForResponse({
      type: 'agent.list',
      content: {}
    });
    
    return response.content.agents;
  }

  /**
   * Send a task to an agent
   * @param {string} agentName - Name of the agent to send the task to
   * @param {Object} taskData - Task data to send
   * @returns {Promise<Object>} - Task result
   */
  async sendTask(agentName, taskData) {
    const response = await this.sendAndWaitForResponse({
      type: 'task.create',
      content: {
        agentName,
        taskData
      }
    });
    
    return {
      taskId: response.content.taskId,
      result: response.content.result
    };
  }

  /**
   * Send a task to an agent and wait for the response
   * @param {Object} options - Task options
   * @param {string} options.agentName - Name of the agent
   * @param {Object} options.taskData - Task data
   * @returns {Promise<Object>} - Task result
   */
  async sendTaskAndWaitForResponse(options) {
    const { agentName, taskData } = options;
    
    if (!agentName) {
      throw new Error('Agent name is required');
    }
    
    if (!taskData) {
      throw new Error('Task data is required');
    }
    
    return this.sendTask(agentName, taskData);
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
   * Disconnect from the orchestrator
   */
  disconnect() {
    if (this.ws) {
      this.autoReconnect = false; // Disable reconnection
      this.ws.close();
      console.log('Disconnected from orchestrator');
    }
  }
}

module.exports = SwarmClientSDK; 