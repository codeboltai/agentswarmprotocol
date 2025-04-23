const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

/**
 * SwarmAgentSDK - Base class for Agent Swarm Protocol agents
 * Handles communication with the orchestrator, message handling, and service requests
 */
class SwarmAgentSDK extends EventEmitter {
  /**
   * Create a new SwarmAgentSDK instance
   * @param {Object} config - Configuration for the agent
   * @param {string} config.name - Name of the agent
   * @param {string[]} config.capabilities - Array of agent capabilities
   * @param {string} config.orchestratorUrl - WebSocket URL of the orchestrator
   * @param {Object} config.manifest - Additional agent metadata
   */
  constructor(config = {}) {
    super();
    
    this.name = config.name;
    this.capabilities = config.capabilities || [];
    this.orchestratorUrl = config.orchestratorUrl || process.env.ORCHESTRATOR_URL || 'ws://localhost:3000';
    this.manifest = config.manifest || {};
    this.pendingResponses = {};
    this.agentId = null;
    this.connected = false;
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
  }

  /**
   * Connect to the orchestrator and register the agent
   * @returns {Promise<void>} Resolves when connected and registered
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
          
          // Register the agent
          this.register().then(() => {
            resolve();
          }).catch(reject);
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
   * Register the agent with the orchestrator
   * @returns {Promise<Object>} - Registration response
   */
  async register() {
    console.log(`Registering agent: ${this.name}`);
    
    const registrationMessage = {
      type: 'agent.register',
      id: uuidv4(),
      content: {
        name: this.name,
        capabilities: this.capabilities,
        manifest: this.manifest
      }
    };
    
    return this.sendAndWaitForResponse(registrationMessage);
  }

  /**
   * Handle incoming messages from the orchestrator
   * @param {Object} message - The received message
   */
  async handleMessage(message) {
    console.log('Received message:', JSON.stringify(message, null, 2));
    
    // Emit the message for custom handlers
    this.emit('message', message);
    
    switch (message.type) {
      case 'agent.registered':
        console.log(`Successfully registered with orchestrator: ${message.content.message}`);
        this.agentId = message.content.agentId;
        this.emit('registered', message.content);
        break;
      
      case 'service.response':
        // Handle service response
        const responseCallback = this.pendingResponses[message.requestId];
        if (responseCallback) {
          responseCallback(message);
          delete this.pendingResponses[message.requestId];
        }
        break;
      
      case 'orchestrator.welcome':
        console.log(`Received welcome message: ${message.content.message}`);
        this.emit('welcome', message.content);
        break;
      
      case 'error':
        console.error(`Received error: ${message.content.error}`);
        const errorCallback = this.pendingResponses[message.requestId];
        if (errorCallback) {
          errorCallback(message);
          delete this.pendingResponses[message.requestId];
        }
        this.emit('error', new Error(message.content.error), message);
        break;
      
      default:
        // Check if this is a task message
        if (message.type && message.type.startsWith('task.')) {
          this.emit('task', message);
        } else {
          console.log(`Unknown message type: ${message.type}`);
        }
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
      this.pendingResponses[messageId] = (response) => {
        clearTimeout(timeoutId);
        
        if (response.type === 'error') {
          reject(new Error(response.content.error));
        } else {
          resolve(response);
        }
      };
    });
  }

  /**
   * Request a service from the orchestrator
   * @param {string} serviceName - Name of the service
   * @param {Object} params - Service parameters
   * @param {Object} options - Additional options
   * @param {number} options.timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Service response
   */
  async requestService(serviceName, params, options = {}) {
    console.log(`Requesting service: ${serviceName}`);
    
    const serviceRequest = {
      type: 'service.request',
      id: uuidv4(),
      content: {
        service: serviceName,
        params
      }
    };
    
    const response = await this.sendAndWaitForResponse(serviceRequest, options);
    return response.content;
  }

  /**
   * Send a task result back to the orchestrator
   * @param {string} requestId - ID of the original task request
   * @param {Object} result - Task result
   * @param {Object} metadata - Additional metadata
   * @returns {string} - Message ID
   */
  sendTaskResult(requestId, result, metadata = {}) {
    return this.send({
      type: 'task.result',
      id: uuidv4(),
      requestId,
      content: {
        result,
        metadata
      }
    });
  }

  /**
   * Send a task error back to the orchestrator
   * @param {string} requestId - ID of the original task request
   * @param {string|Error} error - Error message or object
   * @param {Object} metadata - Additional metadata
   * @returns {string} - Message ID
   */
  sendTaskError(requestId, error, metadata = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    
    return this.send({
      type: 'task.error',
      id: uuidv4(),
      requestId,
      content: {
        error: errorMessage,
        metadata
      }
    });
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

module.exports = SwarmAgentSDK; 