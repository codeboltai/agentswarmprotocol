import * as WebSocket from 'ws';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { 
  PendingResponse, 
  SendOptions,
  BaseMessage,
  Agent,
  AgentStatus
} from '../../../types/common';
import { AgentRegistry } from '../registry/agent-registry';
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
  private messageHandler: any;

  constructor(
    { agents }: AgentServerDependencies, 
    eventBus: EventEmitter, 
    config: AgentServerConfig = {},
    messageHandler?: any
  ) {
    this.agents = agents; // Registry for agent management
    this.eventBus = eventBus;
    this.port = config.port || parseInt(process.env.PORT || '3000', 10);
    this.pendingResponses = {}; // Track pending responses
    // Initialize server and wss to null as they'll be set in start()
    this.server = null as unknown as http.Server;
    this.wss = null as unknown as WebSocket.Server;
    this.messageHandler = messageHandler;
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
      
      // Add as a pending connection in registry
      this.agents.addPendingConnection(connectionId, ws);
      
      // Handle incoming messages from agents
      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          await this.handleMessage(parsedMessage, connectionId);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(connectionId, 'Error processing message', error instanceof Error ? error.message : String(error));
        }
      });
      
      // Handle disconnections
      ws.on('close', () => {
        console.log(`Agent connection closed: ${connectionId}`);
        // Remove the connection from the registry
        this.agents.removeConnection(connectionId);
        // Emit event for disconnection, let the message handler deal with it
        this.eventBus.emit('agent.disconnected', connectionId);
      });
      
      // Send welcome message
      try {
        const welcomeMessage = {
          id: connectionId,
          type: 'orchestrator.welcome',
          content: {
            message: 'Connected to ASP Orchestrator',
            orchestratorVersion: '1.0.0'
          }
        };
        ws.send(JSON.stringify(welcomeMessage));
      } catch (error) {
        console.error('Error sending welcome message:', error);
      }
    });
    
    // Start HTTP server for agents
    this.server.listen(this.port, () => {
      console.log(`ASP Orchestrator running on port ${this.port} (for agents)`);
    });

    return this;
  }

  async handleMessage(message: BaseMessage, connectionId: string): Promise<void> {
    console.log(`Received agent message: ${JSON.stringify(message)}`);
    console.log(`Message content structure: ${JSON.stringify({
      contentType: message.content ? typeof message.content : 'undefined',
      hasTaskId: message.content?.taskId ? true : false,
      hasType: message.content?.type ? true : false,
      hasData: message.content?.data ? true : false,
      dataType: message.content?.data ? typeof message.content.data : 'undefined',
      dataIsEmpty: message.content?.data ? Object.keys(message.content.data).length === 0 : true
    })}`);
    
    if (!message.type) {
      return this.sendError(connectionId, 'Invalid message format: type is required', message.id);
    }
    
    try {
      switch (message.type) {
        case 'agent.register':
          try {
            // Handle agent registration directly in the agent server
            const registrationResult = this.handleAgentRegistration(message, connectionId);
            if (registrationResult.error) {
              this.sendError(connectionId, registrationResult.error, message.id);
              return;
            }
            
            this.send(connectionId, {
              id: uuidv4(),
              type: 'agent.registered',
              content: registrationResult,
              requestId: message.id,
              timestamp: Date.now().toString()
            });
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        case 'agent.list.request':
          // Emit agent list request event
          this.eventBus.emit('agent.list.request', message.content?.filters || {}, (result: any) => {
            if (result.error) {
              this.sendError(connectionId, result.error, message.id);
              return;
            }
            
            // Send the result back to the agent
            this.send(connectionId, {
              id: uuidv4(),
              type: 'agent.list.response',
              content: {
                agents: result
              },
              requestId: message.id,
              timestamp: Date.now().toString()
            });
          });
          break;
          
        case 'service.list':
          // Emit service list event
          this.eventBus.emit('client.service.list', message.content?.filters || {}, (services: any) => {
            if (services.error) {
              this.sendError(connectionId, services.error, message.id);
              return;
            }
            
            // Send the result back to the agent
            this.send(connectionId, {
              id: uuidv4(),
              type: 'service.list.result',
              content: {
                services
              },
              requestId: message.id,
              timestamp: Date.now().toString()
            });
          });
          break;
          
        case 'service.task.execute':
          // Emit service task execute event
          this.eventBus.emit('service.task.execute', message, connectionId, (serviceResult: any) => {
            if (serviceResult.error) {
              this.sendError(connectionId, serviceResult.error, message.id);
              return;
            }
            
            // Send the result back
            this.send(connectionId, {
              id: uuidv4(),
              type: 'service.task.result',
              content: serviceResult,
              requestId: message.id,
              timestamp: Date.now().toString()
            });
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
          
        case 'task.status':
          // Emit task status update event
          console.log(`Task status update received: ${message.content.taskId} status: ${message.content.status}`);
          this.eventBus.emit('task.status.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        case 'service.task.result':
          // Emit service task result event
          console.log(`Service task result received: ${message.id}`);
          this.eventBus.emit('service.task.result.received', message);
          this.eventBus.emit('response.message', message);
          break;
          
        case 'task.notification':
          // Handle task notification from agent
          // Get the agent information from the connection
          const agent = this.agents.getAgentByConnectionId(connectionId);
          
          if (!agent) {
            this.sendError(connectionId, 'Agent not registered or unknown', message.id);
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
          this.send(connectionId, {
            id: uuidv4(),
            type: 'notification.received',
            content: {
              message: 'Notification received',
              notificationId: message.id
            },
            requestId: message.id,
            timestamp: Date.now().toString()
          });
          break;
          
        case 'agent.status':
          // Handle agent status update
          const statusAgent = this.agents.getAgentByConnectionId(connectionId);
          
          if (!statusAgent) {
            this.sendError(connectionId, 'Agent not registered or unknown', message.id);
            return;
          }
          
          // Update agent status in the registry
          this.agents.updateAgentStatus(
            statusAgent.id, 
            message.content.status, 
            message.content
          );
          
          // Confirm receipt
          this.send(connectionId, {
            id: uuidv4(),
            type: 'agent.status.updated',
            content: {
              message: 'Agent status updated',
              status: message.content.status
            },
            requestId: message.id,
            timestamp: Date.now().toString()
          });
          break;
          
        case 'mcp.servers.list':
          // Direct SDK-style request for MCP servers list
          // Forward to the message handler for processing
          try {
            const response = this.messageHandler.handleMessage(message, connectionId);
            
            if (response) {
              this.send(connectionId, {
                ...response,
                id: uuidv4(),
                requestId: message.id,
                timestamp: Date.now().toString()
              });
            }
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        case 'mcp.tools.list':
          // Direct SDK-style request for MCP tools list
          try {
            const response = this.messageHandler.handleMessage(message, connectionId);
            
            if (response) {
              this.send(connectionId, {
                ...response,
                id: uuidv4(),
                requestId: message.id,
                timestamp: Date.now().toString()
              });
            }
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        case 'mcp.tool.execute':
          // Direct SDK-style request for MCP tool execution
          try {
            const response = this.messageHandler.handleMessage(message, connectionId);
            
            if (response) {
              this.send(connectionId, {
                ...response,
                id: uuidv4(),
                requestId: message.id,
                timestamp: Date.now().toString()
              });
            }
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        case 'ping':
          // Respond with pong message
          this.send(connectionId, {
            id: uuidv4(),
            type: 'pong',
            content: {
              timestamp: Date.now()
            },
            requestId: message.id,
            timestamp: Date.now().toString()
          });
          break;
          
        case 'mcp.servers.list.request':
          // For backward compatibility, handle the old mcp.servers.list.request format
          try {
            const response = this.messageHandler.handleMessage({
              ...message,
              type: 'mcp.servers.list'
            }, connectionId);
            
            if (response) {
              this.send(connectionId, {
                ...response,
                id: uuidv4(),
                requestId: message.id,
                timestamp: Date.now().toString()
              });
            }
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        case 'mcp.tools.list.request':
          // For backward compatibility, handle the old mcp.tools.list.request format
          try {
            const response = this.messageHandler.handleMessage({
              ...message,
              type: 'mcp.tools.list'
            }, connectionId);
            
            if (response) {
              this.send(connectionId, {
                ...response,
                id: uuidv4(),
                requestId: message.id,
                timestamp: Date.now().toString()
              });
            }
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        case 'mcp.tool.execute.request':
          // For backward compatibility, handle the old mcp.tool.execute.request format
          try {
            const response = this.messageHandler.handleMessage({
              ...message,
              type: 'mcp.tool.execute'
            }, connectionId);
            
            if (response) {
              this.send(connectionId, {
                ...response,
                id: uuidv4(),
                requestId: message.id,
                timestamp: Date.now().toString()
              });
            }
          } catch (error) {
            this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
          }
          break;
          
        default:
          console.warn(`Unhandled message type agent-server: ${message.type}`);
          this.sendError(connectionId, `Unsupported message type: ${message.type}`, message.id);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
    }
  }

  // Helper method to send messages
  send(connectionIdOrAgentId: string, message: BaseMessage): string {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now().toString();
    
    try {
      // First, try to find the connection directly
      let connection = this.agents.getConnection(connectionIdOrAgentId);
      
      // If not found, maybe it's an agent ID
      if (!connection) {
        connection = this.agents.getConnectionByAgentId(connectionIdOrAgentId);
      }
      
      if (!connection) {
        throw new Error(`Connection not found for ID: ${connectionIdOrAgentId}`);
      }
      
      connection.send(JSON.stringify(message));
      return message.id;
    } catch (error) {
      console.error('Error sending message:', error);
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
      this.send(connectionId, message);
    } catch (error) {
      console.error('Error sending error message:', error);
    }
  }

  /**
   * Handle agent registration
   * @param message - Registration message
   * @param connectionId - Agent connection ID
   * @returns Registration result
   */
  handleAgentRegistration(message: BaseMessage, connectionId: string): any {
    if (!message.content) {
      return { error: 'Invalid agent registration: content is required' };
    }
    
    // Extract agent data from the message
    const {
      id,
      name,
      description,
      status = 'online',
      capabilities = [],
      manifest = null
    } = message.content;
    
    // Validate required fields
    if (!id) {
      return { error: 'Invalid agent registration: id is required' };
    }
    
    if (!name) {
      return { error: 'Invalid agent registration: name is required' };
    }
    
    try {
      // Create the agent object
      const agent: Agent = {
        id,
        name,
        capabilities: capabilities || [],
        status: status as AgentStatus || 'online',
        connectionId,
        registeredAt: new Date().toISOString(),
        manifest: manifest || (description ? { description } : undefined)
      };
      
      // Register the agent in the registry with the connection id
      this.agents.registerAgent(agent, connectionId);
      
      // Log the registration event
      console.log(`Agent ${name} (${id}) registered successfully with connection ${connectionId}`);
      
      // Emit event for agent registration
      this.eventBus.emit('agent.registered', id, connectionId);
      
      return {
        id,
        name,
        status,
        message: 'Agent registered successfully'
      };
    } catch (error) {
      console.error(`Error registering agent: ${error instanceof Error ? error.message : String(error)}`);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Helper method to send a message and wait for a response
  async sendAndWaitForResponse(agentId: string, message: BaseMessage, options: SendOptions = {}): Promise<any> {
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
      this.send(agentId, message);
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