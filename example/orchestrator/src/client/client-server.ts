import * as WebSocket from 'ws';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, PendingResponse, SendOptions } from '../../../types/common';
import { EventEmitter } from 'events';
import { ClientRegistry, Client } from '../registry/client-registry';
import { logger, MessageDirection } from '../core/utils/logger';

// Extended WebSocket interface with ID
interface WebSocketWithId extends WebSocket.WebSocket {
  id: string;
}

interface ClientServerConfig {
  clientPort?: number;
  clientRegistry?: ClientRegistry;
}

/**
 * ClientServer - Handles WebSocket communication with clients
 * Responsible only for communication layer, not business logic
 */
class ClientServer {
  private eventBus: EventEmitter;
  private clientPort: number;
  private clientConnections: Map<string, WebSocketWithId>;
  private pendingResponses: Record<string, PendingResponse>;
  private clientServer: http.Server;
  private clientWss: WebSocket.Server;
  private clientRegistry: ClientRegistry;
  
  constructor(eventBus: EventEmitter, config: ClientServerConfig = {}) {
    this.eventBus = eventBus;
    this.clientPort = config.clientPort || parseInt(process.env.CLIENT_PORT || '3001', 10);
    this.clientConnections = new Map(); // Store client connections
    this.pendingResponses = {}; // Track pending responses
    this.clientRegistry = config.clientRegistry || new ClientRegistry();
    
    // Initialize clientServer and clientWss to null as they'll be set in start()
    this.clientServer = null as unknown as http.Server;
    this.clientWss = null as unknown as WebSocket.Server;
  }

  async start(): Promise<ClientServer> {
    // Create HTTP server for clients
    this.clientServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Agent Swarm Protocol Client Interface is running');
    });

    // Create WebSocket server for clients
    this.clientWss = new WebSocket.Server({ server: this.clientServer });
    
    // Handle WebSocket connections from clients
    this.clientWss.on('connection', (ws: WebSocket.WebSocket) => {
      // Generate unique ID for the client connection
      const clientId = uuidv4();
      const clientWs = ws as WebSocketWithId;
      clientWs.id = clientId;
      
      logger.connection(MessageDirection.CLIENT_TO_ORCHESTRATOR, 'connected', clientId);
      this.clientConnections.set(clientId, clientWs);
      
      // Register the client in the registry with the connection ID
      this.clientRegistry.registerClient({
        id: clientId,
        connectionId: clientId,
        status: 'online'
      });
      
      // Handle incoming messages from clients
      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          await this.handleMessage(parsedMessage, clientId);
        } catch (error) {
          logger.error(MessageDirection.CLIENT_TO_ORCHESTRATOR, 'Error handling client message', error, clientId);
          this.sendError(
            clientId,
            'Error processing message',
            null,
            error instanceof Error ? error.message : String(error)
          );
        }
      });
      
      // Handle client disconnections
      ws.on('close', () => {
        logger.connection(MessageDirection.CLIENT_TO_ORCHESTRATOR, 'disconnected', clientId);
        this.clientConnections.delete(clientId);
        
        // Update client status in registry
        this.clientRegistry.handleDisconnection(clientId);
        
        // Emit event for MessageHandler
        this.eventBus.emit('client.disconnected', clientId);
      });
      
      // Send welcome message to client
      this.send(clientId, {
        id: uuidv4(),
        type: 'orchestrator.client.welcome',
        content: {
          message: 'Connected to ASP Client Interface',
          clientId: clientId,
          orchestratorVersion: '1.0.0'
        }
      });
    });
    
    // Start HTTP server for clients
    this.clientServer.listen(this.clientPort, () => {
      logger.system(`ASP Client Interface running on port ${this.clientPort} (for clients)`);
    });

    return this;
  }

  // Helper method to send error responses with consistent format
  sendError(clientId: string, errorMessage: string, requestId: string | null = null, details?: string): void {
    const message: BaseMessage = {
      id: uuidv4(),
      type: 'error',
      content: {
        error: errorMessage,
        details: details || errorMessage
      }
    };
    
    if (requestId) {
      message.requestId = requestId;
    }
    
    const result = this.send(clientId, message);
    if (result === false) {
      logger.error(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Error sending error message: Client not connected`, undefined, clientId);
    }
  }

  // Handle messages from clients - similar to AgentServer pattern
  async handleMessage(message: BaseMessage, clientId: string): Promise<void> {
    logger.clientToOrchestrator(`Received message: ${message.type}`, {
      messageId: message.id,
      type: message.type,
      content: message.content,
      requestId: message.requestId
    }, clientId);
    
    if (!message.type) {
      return this.sendError(clientId, 'Invalid message format', message.id, 'Message type is required');
    }
    
    // Handle different message types with switch-case for better readability
    switch (message.type) {
      // Client registration and management
      case 'client.register':
        this.eventBus.emit('client.register', message, clientId);
        break;
        
      case 'client.list':
        this.eventBus.emit('client.list.request', message, clientId);
        break;
        
      // Task-related operations
      case 'client.agent.task.create.request':
        this.eventBus.emit('client.agent.task.create.request', message, clientId);
        break;
        
      case 'client.agent.task.status.request':
        this.eventBus.emit('client.agent.task.status.request', message, clientId);
        break;
        
      // Agent operations
      case 'client.agent.list.request':
        this.eventBus.emit('client.agent.list.request', message, clientId, this);
        break;
        
      // MCP-related operations
      case 'client.mcp.server.list.request':
        this.eventBus.emit('client.mcp.server.list.request', message, clientId);
        break;
        
      case 'mcp.server.tools':
        this.eventBus.emit('client.mcp.server.tools.request', message, clientId);
        break;
        
      case 'mcp.tool.execute':
        this.eventBus.emit('client.mcp.tool.execute.request', message, clientId);
        break;
        
      // Message routing
      case 'client.message':
        this.eventBus.emit('client.direct.message', message, clientId);
        break;
        
      // NEW: Handle task.message from client SDK
      case 'task.message':
        this.eventBus.emit('task.message', message, clientId);
        break;
        
      case 'ping':
        this.send(clientId, {
          id: uuidv4(),
          type: 'pong',
          content: {
            timestamp: Date.now()
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
        break;
        
      // Unrecognized message type
      default:
        // For any unhandled message types, still emit the event but warn about it
        this.eventBus.emit(message.type, message, clientId);
        
        // If no listeners for this specific message type, log a warning
        if (this.eventBus.listenerCount(message.type) === 0) {
          logger.warn(MessageDirection.CLIENT_TO_ORCHESTRATOR, `No handlers registered for message type: ${message.type}`, { messageType: message.type }, clientId);
          this.sendError(clientId, `Unsupported message type: ${message.type}`, message.id);
        }
        break;
    }
  }
  
  // Helper method to send messages to clients - similar to AgentServer.send
  send(clientId: string, message: BaseMessage): string | false {
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now().toString();
    
    try {
      // Find the client connection
      const connection = this.getClientConnection(clientId);
      
      if (!connection) {
        logger.warn(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Connection not found for client ID: ${clientId}`, undefined, clientId);
        return false;
      }
      
      connection.send(JSON.stringify(message));
      
      // Update client's lastActiveAt timestamp
      const client = this.clientRegistry.getClientById(clientId);
      if (client) {
        this.clientRegistry.updateClient({
          ...client,
          lastActiveAt: new Date().toISOString()
        });
      }
      
      return message.id;
    } catch (error) {
      logger.error(MessageDirection.ORCHESTRATOR_TO_CLIENT, 'Error sending message to client', error, clientId);
      return false;
    }
  }
  
  /**
   * Helper to get client connection by ID
   * @param clientId - The client ID to look up
   * @returns The WebSocket connection or undefined if not found
   */
  getClientConnection(clientId: string): WebSocketWithId | undefined {
    // First check if we have a connection directly with this ID
    const directConnection = this.clientConnections.get(clientId);
    if (directConnection) {
      return directConnection;
    }
    
    // If not, check if this is a client ID that has a different connection ID
    const client = this.clientRegistry.getClientById(clientId);
    if (client && client.connectionId) {
      return this.clientConnections.get(client.connectionId);
    }
    
    return undefined;
  }
  
  // Check if client is connected
  hasClientConnection(clientId: string): boolean {
    return this.getClientConnection(clientId) !== undefined;
  }
  
  /**
   * Send a message to all connected clients
   * @param message - The message to send to all clients
   * @param options - Optional parameters for filtering clients
   * @returns Array of client IDs that received the message
   */
  sendToAllClients(message: BaseMessage, options: { 
    excludeClientIds?: string[],
    onlyOnlineClients?: boolean 
  } = {onlyOnlineClients: true}): string[] {
    const { excludeClientIds = [], onlyOnlineClients = true } = options;
    const sentToClients: string[] = [];
    
    if (!message.id) {
      message.id = uuidv4();
    }
    
    message.timestamp = Date.now().toString();
    
    // Iterate through all client connections
    this.clientConnections.forEach((connection, clientId) => {
      // Skip excluded clients
      if (excludeClientIds.includes(clientId)) {
        return;
      }
      
      // Check if we should only send to online clients
      if (onlyOnlineClients) {
        const client = this.clientRegistry.getClientById(clientId);
        if (!client || client.status !== 'online') {
          return;
        }
      }
      
      try {
        // Send the message to this client
        connection.send(JSON.stringify(message));
        sentToClients.push(clientId);
        
        // Update client's lastActiveAt timestamp
        const client = this.clientRegistry.getClientById(clientId);
        if (client) {
          this.clientRegistry.updateClient({
            ...client,
            lastActiveAt: new Date().toISOString()
          });
        }
        
        logger.orchestratorToClient(`Broadcast message sent`, { messageType: message.type }, clientId);
      } catch (error) {
        logger.error(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Error sending broadcast message`, error, clientId);
      }
    });
    
    logger.orchestratorToClient(`Broadcast message sent to ${sentToClients.length} clients`, { messageType: message.type, clientCount: sentToClients.length });
    return sentToClients;
  }
  
  /**
   * Send a notification to all connected clients
   * @param notificationType - Type of notification (e.g., 'system', 'agent', 'service')
   * @param notificationMessage - The notification message
   * @param data - Additional data to include in the notification
   * @param options - Optional parameters for filtering clients
   * @returns Array of client IDs that received the notification
   */
  broadcastNotification(
    notificationType: string, 
    notificationMessage: string, 
    data: any = {}, 
    options: { excludeClientIds?: string[], onlyOnlineClients?: boolean } = {}
  ): string[] {
    const message: BaseMessage = {
      id: uuidv4(),
      type: 'system.notification',
      content: {
        notificationType,
        message: notificationMessage,
        data,
        timestamp: new Date().toISOString()
      }
    };
    
    return this.sendToAllClients(message, options);
  }
  
  // Forward task results to clients - called by the Orchestrator
  forwardTaskResultToClient(clientId: string, taskId: string, content: any): void {
    const result = this.send(clientId, {
      id: uuidv4(),
      type: 'client.agent.task.result',
      content: {
        taskId,
        ...content
      }
    });
    
    if (result === false) {
      logger.warn(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Could not forward task result - client not connected`, { taskId }, clientId);
    }
  }
  
  // Forward task errors to clients - called by the Orchestrator
  forwardTaskErrorToClient(clientId: string, message: any): void {
    const result = this.send(clientId, {
      id: uuidv4(),
      type: 'task.error',
      content: message
    });
    
    if (result === false) {
      logger.warn(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Could not forward task error - client not connected`, { error: message }, clientId);
    }
  }
  
  // Forward task notifications to clients - called by the Orchestrator
  forwardTaskNotificationToClient(clientId: string, content: any): void {
    const result = this.send(clientId, {
      id: uuidv4(),
      type: 'task.notification',
      content
    });
    
    if (result === false) {
      logger.warn(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Could not forward task notification - client not connected`, { notification: content }, clientId);
    }
  }
  
  // Forward service notifications to clients
  forwardServiceNotificationToClient(clientId: string, content: any): void {
    const result = this.send(clientId, {
      id: uuidv4(),
      type: 'service.notification',
      content
    });
    
    if (result === false) {
      logger.warn(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Could not forward service notification - client not connected`, { notification: content }, clientId);
    }
  }
  
  // Forward MCP task execution to clients
  forwardMCPTaskExecutionToClient(clientId: string, content: any): void {
    const result = this.send(clientId, {
      id: uuidv4(),
      type: 'mcp.task.execution',
      content
    });
    
    if (result === false) {
      logger.warn(MessageDirection.ORCHESTRATOR_TO_CLIENT, `Could not forward MCP task execution - client not connected`, { mcpTask: content }, clientId);
    }
  }
  
  // Helper method to send a message and wait for a response
  async sendAndWaitForResponse(
    clientId: string, 
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
      
      // Set up response handler
      const responseCallback = (response: BaseMessage) => {
        clearTimeout(timer);
        delete this.pendingResponses[messageId];
        this.eventBus.removeListener('client.response.message', responseHandler);
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
        this.eventBus.removeListener('client.response.message', responseHandler);
        reject(new Error(`Response timeout after ${timeout}ms for message ${messageId}`));
      }, timeout);
      
      // Store pending response
      this.pendingResponses[messageId] = {
        resolve: responseCallback,
        reject,
        timer
      };
      
      // Listen for responses
      this.eventBus.on('client.response.message', responseHandler);
      
      // Send the message
      this.send(clientId, message);
    });
  }
  
  // Stop the client server
  stop(): void {
    if (this.clientServer) {
      this.clientServer.close(() => {
        logger.system('Client server stopped');
      });
      
      // Close all client connections
      this.clientConnections.forEach((ws) => {
        ws.terminate();
      });
    }
  }
}

export default ClientServer; 