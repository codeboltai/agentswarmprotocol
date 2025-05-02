const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

/**
 * ServiceServer - Handles WebSocket communication with services
 * Responsible only for communication layer, not business logic
 */
class ServiceServer {
  constructor({ services }, eventBus, config = {}) {
    this.services = services; // For connection tracking
    this.eventBus = eventBus;
    this.port = config.port || process.env.SERVICE_PORT || 3002;
    this.pendingResponses = {}; // Track pending responses
  }

  async start() {
    // Create HTTP server for services
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Agent Swarm Protocol Service Interface is running');
    });

    // Create WebSocket server for services
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Handle WebSocket connections from services
    this.wss.on('connection', (ws) => {
      // Generate unique ID for the connection
      const connectionId = uuidv4();
      ws.id = connectionId;
      
      console.log(`New service connection established: ${connectionId}`);
      
      // Handle incoming messages from services
      ws.on('message', async (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          await this.handleMessage(parsedMessage, ws);
        } catch (error) {
          console.error('Error handling message from service:', error);
          this.sendError(ws, 'Error processing message', error);
        }
      });
      
      // Handle disconnections
      ws.on('close', () => {
        console.log(`Service connection closed: ${connectionId}`);
        // Emit event for disconnection, let the message handler deal with it
        this.eventBus.emit('service.disconnected', connectionId);
      });
      
      // Send welcome message
      this.send(ws, {
        type: 'orchestrator.welcome',
        content: {
          message: 'Connected to ASP Orchestrator Service Interface',
          orchestratorVersion: '1.0.0'
        }
      });
    });
    
    // Start HTTP server for services
    this.server.listen(this.port, () => {
      console.log(`ASP Orchestrator Service Interface running on port ${this.port}`);
    });

    return this;
  }

  async handleMessage(message, ws) {
    console.log(`Received service message: ${JSON.stringify(message)}`);
    
    if (!message.type) {
      return this.sendError(ws, 'Invalid message format: type is required', message.id);
    }
    
    try {
      switch (message.type) {
        case 'service.register':
          // Emit registration event and wait for response
          this.eventBus.emit('service.register', message, ws.id, (registrationResult) => {
            if (registrationResult.error) {
              this.sendError(ws, registrationResult.error, message.id);
              return;
            }
            
            // Store connection object with the service
            const service = this.services.getServiceById(registrationResult.serviceId);
            if (service) {
              service.connection = ws;
              this.services.updateService(service);
            }
            
            // Send confirmation
            this.send(ws, {
              type: 'service.registered',
              content: registrationResult,
              requestId: message.id
            });
          });
          break;
          
        case 'service.status.update':
          // Emit service status update event
          this.eventBus.emit('service.status.update', message, ws.id, (result) => {
            if (result.error) {
              this.sendError(ws, result.error, message.id);
              return;
            }
            
            // Send confirmation
            this.send(ws, {
              type: 'service.status.updated',
              content: result,
              requestId: message.id
            });
          });
          break;
          
        case 'service.task.result':
          // Emit task result event
          this.eventBus.emit('service.task.result.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        case 'service.task.notification':
          // Handle task notification from service
          const serviceId = this.services.getServiceIdByConnectionId(ws.id);
          
          if (!serviceId) {
            this.sendError(ws, 'Service not registered or unknown', message.id);
            return;
          }
          
          const service = this.services.getServiceById(serviceId);
          
          if (!service) {
            this.sendError(ws, 'Service not found', message.id);
            return;
          }
          
          // Enhance the notification with service information
          const enhancedNotification = {
            ...message,
            content: {
              ...message.content,
              serviceId: service.id,
              serviceName: service.name
            }
          };
          
          // Emit the notification event for the orchestrator to handle
          this.eventBus.emit('service.task.notification.received', enhancedNotification);
          
          // Confirm receipt
          this.send(ws, {
            type: 'notification.received',
            content: {
              message: 'Notification received',
              notificationId: message.id
            },
            requestId: message.id
          });
          break;
          
        case 'service.error':
          // Emit service error event
          this.eventBus.emit('service.error.received', message);
          break;
          
        case 'pong':
          // Handle ping response
          break;
          
        default:
          console.warn(`Unhandled message type from service: ${message.type}`);
          this.sendError(ws, `Unsupported message type: ${message.type}`, message.id);
      }
    } catch (error) {
      console.error('Error handling service message:', error);
      this.sendError(ws, error.message, message.id);
    }
  }

  // Helper method to send messages
  send(ws, message) {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now();
    
    try {
      ws.send(JSON.stringify(message));
      return message.id;
    } catch (error) {
      console.error('Error sending message to service:', error);
      throw error;
    }
  }

  // Helper method to send an error response
  sendError(ws, errorMessage, requestId = null) {
    const message = {
      type: 'error',
      content: {
        error: errorMessage
      }
    };
    
    if (requestId) {
      message.requestId = requestId;
    }
    
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending error message to service:', error);
    }
  }

  // Helper method to send a message and wait for a response
  async sendAndWaitForResponse(ws, message, options = {}) {
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    return new Promise((resolve, reject) => {
      // Generate an ID if not present
      if (!message.id) {
        message.id = uuidv4();
      }
      
      const messageId = message.id;
      
      // Initialize pending responses for this ID if it doesn't exist
      if (!this.pendingResponses[messageId]) {
        this.pendingResponses[messageId] = [];
      }
      
      // Set a timeout
      const timeoutId = setTimeout(() => {
        // Check if we still have callbacks for this message
        if (this.pendingResponses[messageId]) {
          // Remove this specific callback
          const index = this.pendingResponses[messageId].findIndex(cb => cb === responseCallback);
          if (index !== -1) {
            this.pendingResponses[messageId].splice(index, 1);
          }
          
          // If no more callbacks, delete the entry
          if (this.pendingResponses[messageId].length === 0) {
            delete this.pendingResponses[messageId];
          }
          
          reject(new Error(`Response timeout for message ID ${messageId}`));
        }
      }, timeout);
      
      // Define the response callback
      const responseCallback = (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      };
      
      // Add the callback to the list
      this.pendingResponses[messageId].push(responseCallback);

      // Subscribe to response events
      const responseHandler = (message) => {
        if (message.requestId === messageId) {
          responseCallback(message);
        }
      };
      
      this.eventBus.once('response.message', responseHandler);
      
      // Send the message
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeoutId);
        this.eventBus.removeListener('response.message', responseHandler);
        reject(error);
      }
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('Service WebSocket server closed');
    }
  }
}

module.exports = { ServiceServer }; 