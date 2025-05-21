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
 * ServiceServer - Handles WebSocket communication with services
 * Responsible only for communication layer, not business logic
 */
class ServiceServer {
    constructor({ services }, eventBus, config = {}) {
        this.services = services; // For connection tracking
        this.eventBus = eventBus;
        this.port = config.port || parseInt(process.env.SERVICE_PORT || '3002', 10);
        this.pendingResponses = {}; // Track pending responses
        // Initialize server and wss to null as they'll be set in start()
        this.server = null;
        this.wss = null;
        // Initialize connections map
        this.connections = new Map();
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
            const connectionId = (0, uuid_1.v4)();
            const wsWithId = ws;
            wsWithId.id = connectionId;
            // Store connection directly in our map
            this.connections.set(connectionId, wsWithId);
            console.log(`New service connection established: ${connectionId}`);
            // Handle incoming messages from services
            ws.on('message', async (message) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    // Store the WebSocket connection in the registry
                    this.services.setConnection(connectionId, wsWithId);
                    await this.handleMessage(parsedMessage, connectionId);
                }
                catch (error) {
                    console.error('Error handling message from service:', error);
                    this.sendError(connectionId, 'Error processing message', null, error instanceof Error ? error.message : String(error));
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
                id: (0, uuid_1.v4)(),
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
    async handleMessage(message, connectionId) {
        console.log(`Received service message: ${JSON.stringify(message)}`);
        if (!message.type) {
            return this.sendError(connectionId, 'Invalid message format: type is required', message.id);
        }
        // Handle different message types with switch-case for better readability
        switch (message.type) {
            case 'service.register':
                this.eventBus.emit('service.register', message, connectionId, this);
                break;
            case 'service.status.update':
                this.eventBus.emit('service.status.update', message, connectionId, this);
                break;
            case 'service.task.result':
                this.eventBus.emit('service.task.result.received', message, connectionId, this);
                break;
            case 'service.task.notification':
                this.eventBus.emit('service.task.notification', message, connectionId, this);
                break;
            case 'service.error':
                this.eventBus.emit('service.error.received', message, connectionId, this);
                break;
            case 'ping':
                this.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'pong',
                    content: {
                        timestamp: Date.now()
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
                break;
            default:
                // For any unhandled message types, still emit the event but warn about it
                this.eventBus.emit(message.type, message, connectionId, this);
                // If no listeners for this specific message type, log a warning
                if (this.eventBus.listenerCount(message.type) === 0) {
                    console.warn(`No handlers registered for message type: ${message.type}`);
                    this.sendError(connectionId, `Unsupported message type: ${message.type}`, message.id);
                }
                break;
        }
    }
    // Helper method to send messages
    send(connectionId, message) {
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
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
            }
            else {
                console.warn(`Connection not found for ID: ${connectionId}`);
                throw new Error('Connection not found');
            }
        }
        catch (error) {
            console.error('Error sending message to service:', error);
            throw error;
        }
    }
    // Helper method to send an error response
    sendError(connectionId, errorMessage, requestId = null, details) {
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
            // First try to get the connection directly from our connections map
            let ws = this.connections.get(connectionId);
            // If not found, try to get it from the service registry
            if (!ws) {
                ws = this.services.getConnection(connectionId);
            }
            if (ws) {
                ws.send(JSON.stringify(message));
            }
            else {
                console.warn(`Failed to send error, connection not found for ID: ${connectionId}`);
            }
        }
        catch (error) {
            console.error('Error sending error message to service:', error);
        }
    }
    // Helper method to send a message and wait for a response
    async sendAndWaitForResponse(connectionId, message, options = {}) {
        const timeout = options.timeout || 30000; // Default 30 second timeout
        return new Promise((resolve, reject) => {
            // Generate an ID if not present
            if (!message.id) {
                message.id = (0, uuid_1.v4)();
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
            const responseCallback = (response) => {
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
            });
            // Send the message
            this.send(connectionId, message);
        });
    }
    stop() {
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
exports.default = ServiceServer;
