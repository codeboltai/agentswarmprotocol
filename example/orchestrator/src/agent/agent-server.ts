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
import { logger, MessageDirection } from '../core/utils/logger';

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
      
      logger.connection(MessageDirection.AGENT_TO_ORCHESTRATOR, 'connected', connectionId);
      
      // Add as a pending connection in registry
      this.agents.addPendingConnection(connectionId, ws);
      
      // Handle incoming messages from agents
      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          await this.handleMessage(parsedMessage, connectionId);
        } catch (error) {
          logger.error(MessageDirection.AGENT_TO_ORCHESTRATOR, 'Error handling message', error, connectionId);
          this.sendError(connectionId, 'Error processing message', error instanceof Error ? error.message : String(error));
        }
      });
      
      // Handle disconnections
      ws.on('close', () => {
        logger.connection(MessageDirection.AGENT_TO_ORCHESTRATOR, 'disconnected', connectionId);
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
        logger.orchestratorToAgent('Welcome message sent', welcomeMessage, connectionId);
      } catch (error) {
        logger.error(MessageDirection.ORCHESTRATOR_TO_AGENT, 'Error sending welcome message', error, connectionId);
      }
    });
    
    // Start HTTP server for agents
    this.server.listen(this.port, () => {
      logger.system(`ASP Orchestrator Agent Server running on port ${this.port}`);
    });

    return this;
  }

  async handleMessage(message: BaseMessage, connectionId: string): Promise<void> {
    logger.agentToOrchestrator(`Received message: ${message.type}`, message, connectionId);
    logger.debug(MessageDirection.AGENT_TO_ORCHESTRATOR, `Message content structure`, {
      contentType: message.content ? typeof message.content : 'undefined',
      hasTaskId: message.content?.taskId ? true : false,
      hasType: message.content?.type ? true : false,
      hasData: message.content?.data ? true : false,
      dataType: message.content?.data ? typeof message.content.data : 'undefined',
      dataIsEmpty: message.content?.data ? Object.keys(message.content.data).length === 0 : true
    }, connectionId);
    
    if (!message.type) {
      logger.error(MessageDirection.AGENT_TO_ORCHESTRATOR, 'Invalid message format: type is required', message, connectionId);
      return this.sendError(connectionId, 'Invalid message format: type is required', message.id);
    }
    
    // Handle different message types with switch-case for better readability
    switch (message.type) {
      case 'agent.register':
        this.eventBus.emit('agent.register', message, connectionId);
        break;
        
      case 'agent.list.request':
        this.eventBus.emit('agent.list.request', message, connectionId);
        break;
      case 'agent.agent.list.request':
        this.eventBus.emit('agent.agent.list.request', message, connectionId);
        break;
      case 'agent.service.list.request':
        this.eventBus.emit('agent.service.list.request', message, connectionId);
        break;
        
      case 'service.task.execute':
        this.eventBus.emit('service.task.execute', message, connectionId);
        break;
      case 'task.result':
      case 'agent.task.result':
        this.eventBus.emit('agent.task.result.received', message, connectionId);
        break;
        
      case 'task.error':
        this.eventBus.emit('task.error', message, connectionId);
        break;
        
      case 'task.status':
        this.eventBus.emit('task.status', message, connectionId);
        break;
        
      case 'service.task.result':
        this.eventBus.emit('service.task.result', message, connectionId);
        break;
        
      case 'task.notification':
        this.eventBus.emit('task.notification', message, connectionId);
        break;
        
      case 'agent.status':
        this.eventBus.emit('agent.status', message, connectionId);
        break;
        
      case 'agent.request':
        // Map the AgentManager format to the orchestrator format
        const mappedMessage = {
          ...message,
          content: {
            targetAgentName: message.content.targetAgent,
            taskType: message.content.taskData?.type || 'generic',
            taskData: message.content.taskData,
            timeout: message.content.timeout
          }
        };
        this.eventBus.emit('agent.task.request', mappedMessage, connectionId);
        break;
        
      case 'mcp.servers.list':
      case 'mcp.servers.list.request': // backward compatibility
        this.eventBus.emit('mcp.servers.list', message, connectionId);
        break;
        
      case 'mcp.tools.list':
      case 'mcp.tools.list.request': // backward compatibility
        this.eventBus.emit('mcp.tools.list', message, connectionId);
        break;
        
      case 'mcp.tool.execute':
      case 'mcp.tool.execute.request': // backward compatibility
        this.eventBus.emit('mcp.tool.execute', message, connectionId);
        break;
        
      case 'ping':
        this.eventBus.emit('ping', message, connectionId);
        break;
        
      case 'task.message':
        // Handle task.message from agents - emit with agent context
        this.eventBus.emit('agent.task.message', message, connectionId);
        break;
        
      default:
        // For any unhandled message types, still emit the event but warn about it
        this.eventBus.emit(message.type, message, connectionId);
        
        // If no listeners for this specific message type, log a warning
        if (this.eventBus.listenerCount(message.type) === 0) {
          logger.warn(MessageDirection.AGENT_TO_ORCHESTRATOR, `No handlers registered for message type: ${message.type}`, { messageType: message.type }, connectionId);
          this.sendError(connectionId, `Unsupported message type: ${message.type}`, message.id);
        }
        break;
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
      logger.error(MessageDirection.ORCHESTRATOR_TO_AGENT, 'Error sending message', error, connectionIdOrAgentId);
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
      logger.error(MessageDirection.ORCHESTRATOR_TO_AGENT, 'Error sending error message', error, connectionId);
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
      agentId,
      name,
      description,
      status = 'online',
      capabilities = [],
      manifest = null
    } = message.content;
    
    // Use id or agentId if provided, or generate a new one
    const actualId = id || agentId || manifest?.id || uuidv4();
    
    // Validate required fields
    if (!name) {
      return { error: 'Invalid agent registration: name is required' };
    }
    
    try {
      // Create the agent object
      const agent: Agent = {
        id: actualId,
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
      logger.agentToOrchestrator(`Agent registered successfully`, { agentName: name, agentId: actualId }, connectionId);
      
      // Emit event for agent registration
      // this.eventBus.emit('agent.registered', actualId, connectionId);
      
      return {
        id: actualId,
        agentId: actualId, // Include both formats for compatibility
        name,
        status,
        message: 'Agent successfully registered'
      };
    } catch (error) {
      logger.error(MessageDirection.AGENT_TO_ORCHESTRATOR, `Error registering agent`, error, connectionId);
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
        reject(new Error(`Response timeout after ${timeout}ms for message ${messageId}`));
      }, timeout);
      
      // Store pending response
      this.pendingResponses[messageId] = {
        resolve: responseCallback,
        reject,
        timer
      };
      
      
      // Send the message
      this.send(agentId, message);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close(() => {
        logger.system('Agent server stopped');
      });
    }
    
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.terminate();
      });
      
      this.wss.close(() => {
        logger.system('WebSocket server for agents stopped');
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