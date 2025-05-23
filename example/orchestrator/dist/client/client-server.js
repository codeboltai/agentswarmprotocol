"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocket = __importStar(require("ws"));
const http = __importStar(require("http"));
const uuid_1 = require("uuid");
const client_registry_1 = require("../registry/client-registry");
/**
 * ClientServer - Handles WebSocket communication with clients
 * Responsible only for communication layer, not business logic
 */
class ClientServer {
    constructor(eventBus, config = {}) {
        this.eventBus = eventBus;
        this.clientPort = config.clientPort || parseInt(process.env.CLIENT_PORT || '3001', 10);
        this.clientConnections = new Map(); // Store client connections
        this.pendingResponses = {}; // Track pending responses
        this.clientRegistry = config.clientRegistry || new client_registry_1.ClientRegistry();
        // Initialize clientServer and clientWss to null as they'll be set in start()
        this.clientServer = null;
        this.clientWss = null;
    }
    async start() {
        // Create HTTP server for clients
        this.clientServer = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Agent Swarm Protocol Client Interface is running');
        });
        // Create WebSocket server for clients
        this.clientWss = new WebSocket.Server({ server: this.clientServer });
        // Handle WebSocket connections from clients
        this.clientWss.on('connection', (ws) => {
            // Generate unique ID for the client connection
            const clientId = (0, uuid_1.v4)();
            const clientWs = ws;
            clientWs.id = clientId;
            console.log(`New client connection established: ${clientId}`);
            this.clientConnections.set(clientId, clientWs);
            // Register the client in the registry with the connection ID
            this.clientRegistry.registerClient({
                id: clientId,
                connectionId: clientId,
                status: 'online'
            });
            // Handle incoming messages from clients
            ws.on('message', async (message) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    await this.handleMessage(parsedMessage, clientId);
                }
                catch (error) {
                    console.error('Error handling client message:', error);
                    this.sendError(clientId, 'Error processing message', null, error instanceof Error ? error.message : String(error));
                }
            });
            // Handle client disconnections
            ws.on('close', () => {
                console.log(`Client connection closed: ${clientId}`);
                this.clientConnections.delete(clientId);
                // Update client status in registry
                this.clientRegistry.handleDisconnection(clientId);
                // Emit event for MessageHandler
                this.eventBus.emit('client.disconnected', clientId);
            });
            // Send welcome message to client
            this.send(clientId, {
                id: (0, uuid_1.v4)(),
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
            console.log(`ASP Client Interface running on port ${this.clientPort} (for clients)`);
        });
        return this;
    }
    // Helper method to send error responses with consistent format
    sendError(clientId, errorMessage, requestId = null, details) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'error',
            content: {
                error: errorMessage,
                details: details || errorMessage
            }
        };
        if (requestId) {
            message.requestId = requestId;
        }
        try {
            this.send(clientId, message);
        }
        catch (error) {
            console.error('Error sending error message:', error);
        }
    }
    // Handle messages from clients - similar to AgentServer pattern
    async handleMessage(message, clientId) {
        console.log(`Received client message: ${JSON.stringify(message)}`);
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
            case 'task.status':
                this.eventBus.emit('client.task.status.request', message, clientId);
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
                    id: (0, uuid_1.v4)(),
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
                    console.warn(`No handlers registered for message type: ${message.type}`);
                    this.sendError(clientId, `Unsupported message type: ${message.type}`, message.id);
                }
                break;
        }
    }
    // Helper method to send messages to clients - similar to AgentServer.send
    send(clientId, message) {
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        message.timestamp = Date.now().toString();
        try {
            // Find the client connection
            const connection = this.getClientConnection(clientId);
            if (!connection) {
                throw new Error(`Connection not found for client ID: ${clientId}`);
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
        }
        catch (error) {
            console.error('Error sending message to client:', error);
            throw error;
        }
    }
    /**
     * Helper to get client connection by ID
     * @param clientId - The client ID to look up
     * @returns The WebSocket connection or undefined if not found
     */
    getClientConnection(clientId) {
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
    hasClientConnection(clientId) {
        return this.getClientConnection(clientId) !== undefined;
    }
    /**
     * Send a message to all connected clients
     * @param message - The message to send to all clients
     * @param options - Optional parameters for filtering clients
     * @returns Array of client IDs that received the message
     */
    sendToAllClients(message, options = { onlyOnlineClients: true }) {
        const { excludeClientIds = [], onlyOnlineClients = true } = options;
        const sentToClients = [];
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
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
                console.log(`Broadcast message sent to client: ${clientId}`);
            }
            catch (error) {
                console.error(`Error sending broadcast message to client ${clientId}:`, error);
            }
        });
        console.log(`Broadcast message sent to ${sentToClients.length} clients`);
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
    broadcastNotification(notificationType, notificationMessage, data = {}, options = {}) {
        const message = {
            id: (0, uuid_1.v4)(),
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
    forwardTaskResultToClient(clientId, taskId, content) {
        try {
            this.send(clientId, {
                id: (0, uuid_1.v4)(),
                type: 'task.result',
                content: {
                    taskId,
                    ...content
                }
            });
        }
        catch (error) {
            console.log(`Error forwarding task result to client ${clientId}: ${error}`);
        }
    }
    // Forward task errors to clients - called by the Orchestrator
    forwardTaskErrorToClient(clientId, message) {
        try {
            this.send(clientId, {
                id: (0, uuid_1.v4)(),
                type: 'task.error',
                content: message
            });
        }
        catch (error) {
            console.log(`Error forwarding task error to client ${clientId}: ${error}`);
        }
    }
    // Forward task notifications to clients - called by the Orchestrator
    forwardTaskNotificationToClient(clientId, content) {
        try {
            this.send(clientId, {
                id: (0, uuid_1.v4)(),
                type: 'task.notification',
                content: content
            });
        }
        catch (error) {
            console.log(`Error forwarding task notification to client ${clientId}: ${error}`);
        }
    }
    // Forward service notifications to clients - called by the Orchestrator
    forwardServiceNotificationToClient(clientId, content) {
        try {
            this.send(clientId, {
                id: (0, uuid_1.v4)(),
                type: 'service.notification',
                content: content
            });
        }
        catch (error) {
            console.log(`Error forwarding service notification to client ${clientId}: ${error}`);
        }
    }
    // Forward MCP task executions to clients - called by the Orchestrator
    forwardMCPTaskExecutionToClient(clientId, content) {
        try {
            this.send(clientId, {
                id: (0, uuid_1.v4)(),
                type: 'mcp.task.execution',
                content: content
            });
        }
        catch (error) {
            console.log(`Error forwarding MCP task execution to client ${clientId}: ${error}`);
        }
    }
    // Helper method to send a message and wait for a response
    async sendAndWaitForResponse(clientId, message, options = {}) {
        const timeout = options.timeout || 30000; // Default 30 second timeout
        return new Promise((resolve, reject) => {
            // Generate an ID if not present
            if (!message.id) {
                message.id = (0, uuid_1.v4)();
            }
            const messageId = message.id;
            // Set up response handler
            const responseCallback = (response) => {
                clearTimeout(timer);
                delete this.pendingResponses[messageId];
                this.eventBus.removeListener('client.response.message', responseHandler);
                resolve(response);
            };
            // Listen for response
            const responseHandler = (incomingMessage) => {
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
    stop() {
        if (this.clientServer) {
            this.clientServer.close(() => {
                console.log('Client server stopped');
            });
            // Close all client connections
            this.clientConnections.forEach((ws) => {
                ws.terminate();
            });
        }
    }
}
exports.default = ClientServer;
