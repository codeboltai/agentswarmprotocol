import * as WebSocket from 'ws';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { ServiceRegistry, BaseMessage, SendOptions } from '../../../types/common';
import { EventEmitter } from 'events';

// Extended WebSocket interface with ID
interface WebSocketWithId extends WebSocket.WebSocket {
  id: string;
}

// Define a proper interface for pending responses
interface PendingResponseEntry {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timeout;
}

interface ServiceServerConfig {
  port?: number;
}

interface ServiceServerDependencies {
  services: ServiceRegistry;
}

/**
 * ServiceServer - Handles WebSocket communication with services
 * Responsible only for communication layer, not business logic
 */
class ServiceServer {
  private services: ServiceRegistry; 
  private eventBus: EventEmitter;
  private port: number;
  private pendingResponses: Record<string, PendingResponseEntry[]>;
  private server: http.Server;
  private wss: WebSocket.Server;
  // Add direct connections map for improved connection tracking
  private connections: Map<string, WebSocketWithId>;

  constructor(
    { services }: ServiceServerDependencies, 
    eventBus: EventEmitter, 
    config: ServiceServerConfig = {}
  ) {
    this.services = services; // For connection tracking
    this.eventBus = eventBus;
    this.port = config.port || parseInt(process.env.SERVICE_PORT || '3002', 10);
    this.pendingResponses = {}; // Track pending responses
    // Initialize server and wss to null as they'll be set in start()
    this.server = null as unknown as http.Server;
    this.wss = null as unknown as WebSocket.Server;
    // Initialize connections map
    this.connections = new Map();
  }

  async start(): Promise<ServiceServer> {
    // Create HTTP server for services
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Agent Swarm Protocol Service Interface is running');
    });

    // Create WebSocket server for services
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Handle WebSocket connections from services
    this.wss.on('connection', (ws: WebSocket.WebSocket) => {
      // Generate unique ID for the connection
      const connectionId = uuidv4();
      const wsWithId = ws as WebSocketWithId;
      wsWithId.id = connectionId;
      
      // Store connection directly in our map
      this.connections.set(connectionId, wsWithId);
      
      console.log(`New service connection established: ${connectionId}`);
      
      // Handle incoming messages from services
      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          // Store the WebSocket connection in the registry
          this.services.setConnection(connectionId, wsWithId);
          await this.handleMessage(parsedMessage, connectionId);
        } catch (error) {
          console.error('Error handling message from service:', error);
          this.sendError(
            connectionId, 
            'Error processing message', 
            error instanceof Error ? error.message : String(error)
          );
        }
      });
      
      // Handle disconnections
      ws.on('close', () => {
        console.log(`Service connection closed: ${connectionId}`);
        // Remove from our direct connections map
        this.connections.delete(connectionId);
        // Let the registry handle the disconnection
        this.services.handleDisconnection(connectionId);
        // Emit event for disconnection, let the message handler deal with it
        this.eventBus.emit('service.disconnected', connectionId);
      });
      
      // Send welcome message
      this.send(connectionId, {
        id: uuidv4(),
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

  async handleMessage(message: BaseMessage, connectionId: string): Promise<void> {
    console.log(`Received service message: ${JSON.stringify(message)}`);
    
    if (!message.type) {
      return this.sendError(connectionId, 'Invalid message format: type is required', message.id);
    }
    
    try {
      switch (message.type) {
        case 'service.register':
          // Emit registration event and wait for response
          this.eventBus.emit('service.register', message, connectionId, (registrationResult: any) => {
            if (registrationResult.error) {
              this.sendError(connectionId, registrationResult.error, message.id);
              return;
            }
            
            // The connection is already stored from the message handler
            
            // Send confirmation
            this.send(connectionId, {
              id: uuidv4(),
              type: 'service.registered',
              content: registrationResult,
              requestId: message.id
            });
          });
          break;
          
        case 'service.status.update':
          // Emit service status update event
          this.eventBus.emit('service.status.update', message, connectionId, (result: any) => {
            if (result.error) {
              this.sendError(connectionId, result.error, message.id);
              return;
            }
            
            // Send confirmation
            this.send(connectionId, {
              id: uuidv4(),
              type: 'service.status.updated',
              content: result,
              requestId: message.id
            });
          });
          break;
          
        case 'service.task.result':
          // Emit task result event
          this.eventBus.emit('service.task.result.received', message);
          break;
          
        case 'service.task.notification':
          // Handle task notification from service
          const serviceId = this.services.getServiceByConnectionId(connectionId)?.id;
          
          if (!serviceId) {
            this.sendError(connectionId, 'Service not registered or unknown', message.id);
            return;
          }
          
          const service = this.services.getServiceById(serviceId);
          
          if (!service) {
            this.sendError(connectionId, 'Service not found', message.id);
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
          this.send(connectionId, {
            id: uuidv4(),
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
          this.sendError(connectionId, `Unsupported message type: ${message.type}`, message.id);
      }
    } catch (error) {
      console.error('Error handling service message:', error);
      this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
    }
  }

  // Helper method to send messages
  send(connectionId: string, message: BaseMessage): string {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now().toString();
    
    try {
      // First try to get the connection directly from our connections map
      let ws = this.connections.get(connectionId);
      
      // If not found, try to get it from the service registry
      if (!ws) {
        ws = this.services.getConnection(connectionId);
      }
      
      if (ws) {
        ws.send(JSON.stringify(message));
        return message.id;
      } else {
        console.warn(`Connection not found for ID: ${connectionId}`);
        throw new Error('Connection not found');
      }
    } catch (error) {
      console.error('Error sending message to service:', error);
      throw error;
    }
  }

  // Helper method to send an error response
  sendError(connectionId: string, errorMessage: string, requestId: string | null = null): void {
    const message: BaseMessage = {
      id: uuidv4(),
      type: 'error',
      content: {
        error: errorMessage
      }
    };
    
    if (requestId) {
      message.requestId = requestId;
    }
    
    try {
      // First try to get the connection directly from our connections map
      let ws = this.connections.get(connectionId);
      
      // If not found, try to get it from the service registry
      if (!ws) {
        ws = this.services.getConnection(connectionId);
      }
      
      if (ws) {
        ws.send(JSON.stringify(message));
      } else {
        console.warn(`Failed to send error, connection not found for ID: ${connectionId}`);
      }
    } catch (error) {
      console.error('Error sending error message to service:', error);
    }
  }

  // Helper method to send a message and wait for a response
  async sendAndWaitForResponse(
    connectionId: string, 
    message: BaseMessage, 
    options: SendOptions = {}
  ): Promise<any> {
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
          const index = this.pendingResponses[messageId].findIndex(entry => entry.timer === timeoutId);
          if (index !== -1) {
            this.pendingResponses[messageId].splice(index, 1);
          }
          
          // If no more callbacks, delete the entry
          if (this.pendingResponses[messageId].length === 0) {
            delete this.pendingResponses[messageId];
          }
        }
        
        reject(new Error(`Response timeout after ${timeout}ms for message ${messageId}`));
      }, timeout);
      
      // Define response callback
      const responseCallback = (response: BaseMessage) => {
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Remove this callback from pending responses
        if (this.pendingResponses[messageId]) {
          // Create new array without current entry
          const pendingResponses = [...this.pendingResponses[messageId]];
          
          // Find the index of our entry (using timeoutId to identify it)
          for (let i = 0; i < pendingResponses.length; i++) {
            if (pendingResponses[i].timer === timeoutId) {
              pendingResponses.splice(i, 1);
              break;
            }
          }
          
          this.pendingResponses[messageId] = pendingResponses;
          
          // If no more callbacks, delete the entry
          if (this.pendingResponses[messageId].length === 0) {
            delete this.pendingResponses[messageId];
          }
        }
        
        
        // Resolve the promise with the response
        resolve(response);
      };
      
      // Define response handler
      const responseHandler = (incomingMessage: BaseMessage) => {
        // Check if this is a response to our message
        if (!incomingMessage.requestId || incomingMessage.requestId !== messageId) {
          return;
        }
        
        // Check if there's a response filter
        if (options.responseFilter && !options.responseFilter(incomingMessage)) {
          return;
        }
        
        // Check if this is the type of response we're expecting
        if (options.responseType && incomingMessage.type !== options.responseType) {
          return;
        }
        
        // This is our response, call the callback
        responseCallback(incomingMessage);
      };
      
      // Add listener for response
      
      // Store the response callback
      if (!this.pendingResponses[messageId]) {
        this.pendingResponses[messageId] = [];
      }
      
      this.pendingResponses[messageId].push({
        resolve: responseCallback,
        reject,
        timer: timeoutId
      } as PendingResponseEntry);
      
      // Send the message
      this.send(connectionId, message);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
    }
    
    if (this.wss) {
      this.wss.clients.forEach(client => {
        client.terminate();
      });
      
      this.wss.close();
    }
    
    // Clear any pending responses
    for (const messageId in this.pendingResponses) {
      for (const pendingResponse of this.pendingResponses[messageId]) {
        clearTimeout(pendingResponse.timer);
        pendingResponse.reject(new Error('Server stopped'));
      }
    }
    
    this.pendingResponses = {};
  }
}

export default ServiceServer; 