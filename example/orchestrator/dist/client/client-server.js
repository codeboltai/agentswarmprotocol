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
/**
 * ClientServer - Handles WebSocket communication with clients
 */
class ClientServer {
    constructor(eventBus, config = {}) {
        this.eventBus = eventBus;
        this.clientPort = config.clientPort || parseInt(process.env.CLIENT_PORT || '3001', 10);
        this.clientConnections = new Map(); // Store client connections
        this.pendingResponses = {}; // Track pending responses
        // Initialize clientServer and clientWss to null as they'll be set in start()
        this.clientServer = null;
        this.clientWss = null;
        // Set up event listeners for client communication
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Listen for task results from agents and forward to clients
        this.eventBus.on('task.result', (clientId, taskId, content) => {
            this.forwardTaskResultToClient(clientId, taskId, content);
        });
        // Listen for task errors from agents and forward to clients
        this.eventBus.on('task.error', (clientId, message) => {
            this.forwardTaskErrorToClient(clientId, message);
        });
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
            // Handle incoming messages from clients
            ws.on('message', async (message) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    await this.handleClientMessage(parsedMessage, clientWs);
                }
                catch (error) {
                    console.error('Error handling client message:', error);
                    this.sendToClient(clientWs, {
                        id: (0, uuid_1.v4)(),
                        type: 'error',
                        content: {
                            error: 'Error processing message',
                            details: error instanceof Error ? error.message : String(error)
                        }
                    });
                }
            });
            // Handle client disconnections
            ws.on('close', () => {
                console.log(`Client connection closed: ${clientId}`);
                this.clientConnections.delete(clientId);
            });
            // Send welcome message to client
            this.sendToClient(clientWs, {
                id: (0, uuid_1.v4)(),
                type: 'orchestrator.welcome',
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
    // Handle messages from clients
    async handleClientMessage(message, ws) {
        console.log(`Received client message: ${JSON.stringify(message)}`);
        if (!message.type) {
            return this.sendToClient(ws, {
                id: (0, uuid_1.v4)(),
                type: 'error',
                content: {
                    error: 'Invalid message format',
                    details: 'Message type is required'
                }
            });
        }
        try {
            switch (message.type) {
                case 'task.create':
                    await this.handleClientTaskCreation(message, ws);
                    break;
                case 'task.status':
                    await this.handleClientTaskStatus(message, ws);
                    break;
                case 'agent.list':
                    await this.handleClientAgentList(message, ws);
                    break;
                case 'mcp.server.list':
                    await this.handleClientMCPServerList(message, ws);
                    break;
                case 'client.message':
                    await this.handleClientDirectMessage(message, ws);
                    break;
                default:
                    this.sendToClient(ws, {
                        id: (0, uuid_1.v4)(),
                        type: 'error',
                        content: {
                            error: 'Unsupported message type',
                            details: `Message type '${message.type}' is not supported`
                        }
                    });
            }
        }
        catch (error) {
            console.error('Error handling client message:', error);
            this.sendToClient(ws, {
                id: (0, uuid_1.v4)(),
                type: 'error',
                content: {
                    error: 'Error processing message',
                    details: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    // Handle task creation request from client
    async handleClientTaskCreation(message, ws) {
        // Emit task creation event and wait for response
        this.eventBus.emit('client.task.create', message, ws.id, (result) => {
            if (result.error) {
                this.sendToClient(ws, {
                    type: 'error',
                    id: message.id,
                    content: {
                        error: 'Error creating task',
                        details: result.error
                    }
                });
                return;
            }
            // Notify client of task creation
            this.sendToClient(ws, {
                type: 'task.created',
                id: message.id,
                content: result
            });
        });
    }
    // Handle task status request from client
    async handleClientTaskStatus(message, ws) {
        // Emit task status request event
        this.eventBus.emit('client.task.status', message.content.taskId, (result) => {
            if (result.error) {
                this.sendToClient(ws, {
                    type: 'error',
                    id: message.id,
                    content: {
                        error: 'Error getting task status',
                        details: result.error
                    }
                });
                return;
            }
            this.sendToClient(ws, {
                type: 'task.status',
                id: message.id,
                content: result
            });
        });
    }
    // Handle agent list request from client
    async handleClientAgentList(message, ws) {
        // Emit agent list request event
        this.eventBus.emit('client.agent.list', {}, (result) => {
            if (result.error) {
                this.sendToClient(ws, {
                    type: 'error',
                    id: message.id,
                    content: {
                        error: 'Error getting agent list',
                        details: result.error
                    }
                });
                return;
            }
            this.sendToClient(ws, {
                type: 'agent.list',
                id: message.id,
                content: {
                    agents: result
                }
            });
        });
    }
    // Handle MCP server list request from client
    async handleClientMCPServerList(message, ws) {
        console.log(`Processing MCP server list request: ${JSON.stringify(message)}`);
        // Emit MCP server list request event
        this.eventBus.emit('client.mcp.server.list', message.content?.filters || {}, (result) => {
            console.log(`Received MCP server list result: ${JSON.stringify(result)}`);
            if (result.error) {
                this.sendToClient(ws, {
                    type: 'error',
                    id: message.id, // Use id for consistency
                    content: {
                        error: 'Error getting MCP server list',
                        details: result.error
                    }
                });
                return;
            }
            this.sendToClient(ws, {
                type: 'mcp.server.list',
                id: message.id, // Use id for consistency
                content: {
                    servers: result
                }
            });
        });
    }
    // Handle direct message from client
    async handleClientDirectMessage(message, ws) {
        // A client message can be of two types:
        // 1. A message from a client to an agent
        // 2. A message from a client to another client
        const targetType = message.content?.target?.type;
        const targetId = message.content?.target?.id;
        if (!targetType || !targetId) {
            return this.sendToClient(ws, {
                type: 'error',
                id: message.id,
                content: {
                    error: 'Invalid target',
                    details: 'Target type and ID are required'
                }
            });
        }
        // Enhance message with sender information
        const enhancedMessage = {
            ...message,
            content: {
                ...message.content,
                sender: {
                    id: ws.id,
                    type: 'client'
                }
            }
        };
        // Forward the message based on target type
        if (targetType === 'agent') {
            this.eventBus.emit('client.message.agent', enhancedMessage, targetId, (result) => {
                if (result.error) {
                    this.sendToClient(ws, {
                        type: 'error',
                        id: message.id,
                        content: {
                            error: 'Error sending message to agent',
                            details: result.error
                        }
                    });
                    return;
                }
                // Confirm message delivery
                this.sendToClient(ws, {
                    type: 'message.sent',
                    id: message.id,
                    content: {
                        target: {
                            type: targetType,
                            id: targetId
                        },
                        result: result
                    }
                });
            });
        }
        else if (targetType === 'client') {
            this.eventBus.emit('client.message.client', enhancedMessage, targetId, (result) => {
                if (result.error) {
                    this.sendToClient(ws, {
                        type: 'error',
                        id: message.id,
                        content: {
                            error: 'Error sending message to client',
                            details: result.error
                        }
                    });
                    return;
                }
                // Confirm message delivery
                this.sendToClient(ws, {
                    type: 'message.sent',
                    id: message.id,
                    content: {
                        target: {
                            type: targetType,
                            id: targetId
                        }
                    }
                });
            });
        }
        else {
            this.sendToClient(ws, {
                type: 'error',
                id: message.id,
                content: {
                    error: 'Unsupported target type',
                    details: `Target type '${targetType}' is not supported`
                }
            });
        }
    }
    // Helper method to send messages to clients
    sendToClient(ws, message) {
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        message.timestamp = Date.now().toString();
        try {
            ws.send(JSON.stringify(message));
        }
        catch (error) {
            console.error('Error sending message to client:', error);
            throw error;
        }
    }
    // Forward task results to clients
    forwardTaskResultToClient(clientId, taskId, content) {
        const clientWs = this.getClientConnection(clientId);
        if (!clientWs) {
            console.log(`Client ${clientId} is not connected, cannot forward task result`);
            return;
        }
        this.sendToClient(clientWs, {
            id: (0, uuid_1.v4)(),
            type: 'task.result',
            content: {
                taskId,
                ...content
            }
        });
    }
    // Forward task errors to clients
    forwardTaskErrorToClient(clientId, message) {
        const clientWs = this.getClientConnection(clientId);
        if (!clientWs) {
            console.log(`Client ${clientId} is not connected, cannot forward task error`);
            return;
        }
        this.sendToClient(clientWs, {
            id: (0, uuid_1.v4)(),
            type: 'task.error',
            content: message
        });
    }
    /**
     * Helper to get client connection by ID
     * @param clientId - The client ID to look up
     * @returns The WebSocket connection or undefined if not found
     */
    getClientConnection(clientId) {
        if (!clientId || typeof clientId !== 'string') {
            console.warn(`Invalid client ID passed to getClientConnection: ${typeof clientId}`);
            return undefined;
        }
        const connection = this.clientConnections.get(clientId);
        if (!connection) {
            console.debug(`No connection found for client ID: ${clientId}`);
        }
        return connection;
    }
    // Check if client is connected
    hasClientConnection(clientId) {
        return this.clientConnections.has(clientId);
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
    // Helper method to send a message and wait for a response
    async sendAndWaitForResponse(ws, message, options = {}) {
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
            this.sendToClient(ws, message);
        });
    }
    /**
     * Send a message to a client by ID
     * @param clientId - ID of the client to send the message to
     * @param message - The message to send
     */
    sendMessageToClient(clientId, message) {
        if (!clientId || typeof clientId !== 'string') {
            console.warn(`Invalid client ID passed to sendMessageToClient: ${typeof clientId}`);
            return;
        }
        const clientWs = this.getClientConnection(clientId);
        if (clientWs) {
            try {
                this.sendToClient(clientWs, message);
            }
            catch (error) {
                console.error(`Error sending message to client ${clientId}:`, error);
            }
        }
        else {
            console.warn(`Cannot send message to client ${clientId}: Client not connected`);
        }
    }
}
exports.default = ClientServer;
