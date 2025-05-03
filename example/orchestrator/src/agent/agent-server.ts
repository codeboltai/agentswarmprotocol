import * as WebSocket from 'ws';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { 
  AgentRegistry, 
  PendingResponse, 
  SendOptions,
  BaseMessage
} from '../../../types/common';
import { EventEmitter } from 'events';

// Extended WebSocket interface with ID
interface WebSocketWithId extends WebSocket.WebSocket {
  id: string;
}

interface AgentServerConfig {
  port?: number;
}

interface AgentServerDependencies {
  agents: AgentRegistry;
}

/**
 * AgentServer - Handles WebSocket communication with agents
 * Responsible only for communication layer, not business logic
 */
class AgentServer {
  private agents: AgentRegistry;
  private eventBus: EventEmitter;
  private port: number;
  private pendingResponses: Record<string, PendingResponse>;
  private server: http.Server;
  private wss: WebSocket.Server;

  constructor(
    { agents }: AgentServerDependencies, 
    eventBus: EventEmitter, 
    config: AgentServerConfig = {}
  ) {
    this.agents = agents; // Only needed for connection tracking
    this.eventBus = eventBus;
    this.port = config.port || parseInt(process.env.PORT || '3000', 10);
    this.pendingResponses = {}; // Track pending responses
  }

  async start(): Promise<AgentServer> {
    // Create HTTP server for agents
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Agent Swarm Protocol Orchestrator is running');
    });

    // Create WebSocket server for agents
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Handle WebSocket connections from agents
    this.wss.on('connection', (ws: WebSocket.WebSocket) => {
      // Generate unique ID for the connection
      const connectionId = uuidv4();
      (ws as WebSocketWithId).id = connectionId;
      
      console.log(`New agent connection established: ${connectionId}`);
      
      // Handle incoming messages from agents
      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          await this.handleMessage(parsedMessage, ws as WebSocketWithId);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws as WebSocketWithId, 'Error processing message', error instanceof Error ? error.message : String(error));
        }
      });
      
      // Handle disconnections
      ws.on('close', () => {
        console.log(`Agent connection closed: ${connectionId}`);
        // Emit event for disconnection, let the message handler deal with it
        this.eventBus.emit('agent.disconnected', connectionId);
      });
      
      // Send welcome message
      this.send(ws as WebSocketWithId, {
        type: 'orchestrator.welcome',
        content: {
          message: 'Connected to ASP Orchestrator',
          orchestratorVersion: '1.0.0'
        }
      } as BaseMessage);
    });
    
    // Start HTTP server for agents
    this.server.listen(this.port, () => {
      console.log(`ASP Orchestrator running on port ${this.port} (for agents)`);
    });

    return this;
  }

  async handleMessage(message: BaseMessage, ws: WebSocketWithId): Promise<void> {
    console.log(`Received agent message: ${JSON.stringify(message)}`);
    
    if (!message.type) {
      return this.sendError(ws, 'Invalid message format: type is required', message.id);
    }
    
    try {
      switch (message.type) {
        case 'agent.register':
          // Emit registration event and wait for response
          this.eventBus.emit('agent.register', message, ws.id, (registrationResult: any) => {
            if (registrationResult.error) {
              this.sendError(ws, registrationResult.error, message.id);
              return;
            }
            
            // Store connection object with the agent
            const agent = this.agents.getAgentById(registrationResult.agentId);
            if (agent) {
              (agent as any).connection = ws;
              this.agents.registerAgent(agent);
            }
            
            // Send confirmation
            this.send(ws, {
              type: 'agent.registered',
              content: registrationResult,
              requestId: message.id
            } as BaseMessage);
          });
          break;
          
        case 'service.request':
          // Emit service request event
          this.eventBus.emit('service.request', message, ws.id, (serviceResult: any) => {
            if (serviceResult.error) {
              this.sendError(ws, serviceResult.error, message.id);
              return;
            }
            
            // Send the result back
            this.send(ws, {
              type: 'service.response',
              content: serviceResult,
              requestId: message.id
            } as BaseMessage);
          });
          break;
          
        case 'agent.request':
          // Emit agent request event
          this.eventBus.emit('agent.request.received', message, ws.id, (result: any) => {
            if (result.error) {
              this.sendError(ws, result.error, message.id);
              return;
            }
            
            // The actual communication will be handled by event listeners in the orchestrator
            // This just returns a task ID for tracking
            this.send(ws, {
              type: 'agent.request.accepted',
              content: result,
              requestId: message.id
            } as BaseMessage);
          });
          break;
          
        case 'task.result':
          // Emit task result event
          this.eventBus.emit('task.result.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        case 'task.error':
          // Emit task error event
          this.eventBus.emit('task.error.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        case 'task.notification':
          // Handle task notification from agent
          // Get the agent information from the connection
          const agent = this.agents.getAgentByConnectionId(ws.id);
          
          if (!agent) {
            this.sendError(ws, 'Agent not registered or unknown', message.id);
            return;
          }
          
          // Enhance the notification with agent information
          const enhancedNotification = {
            ...message,
            content: {
              ...message.content,
              agentId: agent.id,
              agentName: agent.name
            }
          };
          
          // Emit the notification event for the orchestrator to handle
          this.eventBus.emit('task.notification.received', enhancedNotification);
          
          // Confirm receipt (optional)
          this.send(ws, {
            type: 'notification.received',
            content: {
              message: 'Notification received',
              notificationId: message.id
            },
            requestId: message.id
          } as BaseMessage);
          break;
          
        default:
          console.warn(`Unhandled message type: ${message.type}`);
          this.sendError(ws, `Unsupported message type: ${message.type}`, message.id);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(ws, error instanceof Error ? error.message : String(error), message.id);
    }
  }

  // Helper method to send messages
  send(ws: WebSocketWithId, message: BaseMessage): string {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now().toString();
    
    try {
      ws.send(JSON.stringify(message));
      return message.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Helper method to send an error response
  sendError(ws: WebSocketWithId, errorMessage: string, requestId: string | null = null): void {
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
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending error message:', error);
    }
  }

  // Helper method to send a message and wait for a response
  async sendAndWaitForResponse(ws: WebSocketWithId, message: BaseMessage, options: SendOptions = {}): Promise<any> {
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    return new Promise((resolve, reject) => {
      // Generate an ID if not present
      if (!message.id) {
        message.id = uuidv4();
      }
      
      const messageId = message.id;
      
      // Set up response handler
      const responseCallback = (response: BaseMessage) => {
        clearTimeout(timer);
        delete this.pendingResponses[messageId];
        resolve(response);
      };
      
      // Listen for response
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
        
        // This is our response
        responseCallback(incomingMessage);
      };
      
      // Set up timeout
      const timer = setTimeout(() => {
        delete this.pendingResponses[messageId];
        this.eventBus.removeListener('response.message', responseHandler);
        reject(new Error(`Response timeout after ${timeout}ms for message ${messageId}`));
      }, timeout);
      
      // Store pending response
      this.pendingResponses[messageId] = {
        resolve: responseCallback,
        reject,
        timer
      };
      
      // Listen for responses
      this.eventBus.on('response.message', responseHandler);
      
      // Send the message
      this.send(ws, message);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('Agent server stopped');
      });
    }
    
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.terminate();
      });
      
      this.wss.close(() => {
        console.log('WebSocket server for agents stopped');
      });
    }
    
    // Clear any pending responses
    Object.values(this.pendingResponses).forEach((pendingResponse) => {
      clearTimeout(pendingResponse.timer);
      pendingResponse.reject(new Error('Server stopped'));
    });
    
    this.pendingResponses = {};
  }
}

export default AgentServer; 