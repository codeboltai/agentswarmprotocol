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
const logger_1 = require("../core/utils/logger");
/**
 * AgentServer - Handles WebSocket communication with agents
 * Responsible only for communication layer, not business logic
 */
class AgentServer {
    constructor({ agents }, eventBus, config = {}, messageHandler) {
        this.agents = agents; // Registry for agent management
        this.eventBus = eventBus;
        this.port = config.port || parseInt(process.env.PORT || '3000', 10);
        this.pendingResponses = {}; // Track pending responses
        // Initialize server and wss to null as they'll be set in start()
        this.server = null;
        this.wss = null;
        this.messageHandler = messageHandler;
    }
    async start() {
        // Create HTTP server for agents
        this.server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Agent Swarm Protocol Orchestrator is running');
        });
        // Create WebSocket server for agents
        this.wss = new WebSocket.Server({ server: this.server });
        // Handle WebSocket connections from agents
        this.wss.on('connection', (ws) => {
            // Generate unique ID for the connection
            const connectionId = (0, uuid_1.v4)();
            ws.id = connectionId;
            logger_1.logger.connection(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'connected', connectionId);
            // Add as a pending connection in registry
            this.agents.addPendingConnection(connectionId, ws);
            // Handle incoming messages from agents
            ws.on('message', async (message) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    await this.handleMessage(parsedMessage, connectionId);
                }
                catch (error) {
                    logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'Error handling message', error, connectionId);
                    this.sendError(connectionId, 'Error processing message', error instanceof Error ? error.message : String(error));
                }
            });
            // Handle disconnections
            ws.on('close', () => {
                logger_1.logger.connection(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'disconnected', connectionId);
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
                logger_1.logger.orchestratorToAgent('Welcome message sent', welcomeMessage, connectionId);
            }
            catch (error) {
                logger_1.logger.error(logger_1.MessageDirection.ORCHESTRATOR_TO_AGENT, 'Error sending welcome message', error, connectionId);
            }
        });
        // Start HTTP server for agents
        this.server.listen(this.port, () => {
            logger_1.logger.system(`ASP Orchestrator Agent Server running on port ${this.port}`);
        });
        return this;
    }
    async handleMessage(message, connectionId) {
        logger_1.logger.agentToOrchestrator(`Received message: ${message.type}`, message, connectionId);
        logger_1.logger.debug(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, `Message content structure`, {
            contentType: message.content ? typeof message.content : 'undefined',
            hasTaskId: message.content?.taskId ? true : false,
            hasType: message.content?.type ? true : false,
            hasData: message.content?.data ? true : false,
            dataType: message.content?.data ? typeof message.content.data : 'undefined',
            dataIsEmpty: message.content?.data ? Object.keys(message.content.data).length === 0 : true
        }, connectionId);
        if (!message.type) {
            logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'Invalid message format: type is required', message, connectionId);
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
                    logger_1.logger.warn(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, `No handlers registered for message type: ${message.type}`, { messageType: message.type }, connectionId);
                    this.sendError(connectionId, `Unsupported message type: ${message.type}`, message.id);
                }
                break;
        }
    }
    // Helper method to send messages
    send(connectionIdOrAgentId, message) {
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
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
        }
        catch (error) {
            logger_1.logger.error(logger_1.MessageDirection.ORCHESTRATOR_TO_AGENT, 'Error sending message', error, connectionIdOrAgentId);
            throw error;
        }
    }
    // Helper method to send an error response
    sendError(connectionId, errorMessage, requestId = null) {
        const message = {
            id: (0, uuid_1.v4)(),
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
        }
        catch (error) {
            logger_1.logger.error(logger_1.MessageDirection.ORCHESTRATOR_TO_AGENT, 'Error sending error message', error, connectionId);
        }
    }
    /**
     * Handle agent registration
     * @param message - Registration message
     * @param connectionId - Agent connection ID
     * @returns Registration result
     */
    handleAgentRegistration(message, connectionId) {
        if (!message.content) {
            return { error: 'Invalid agent registration: content is required' };
        }
        // Extract agent data from the message
        const { id, agentId, name, description, status = 'online', capabilities = [], manifest = null } = message.content;
        // Use id or agentId if provided, or generate a new one
        const actualId = id || agentId || manifest?.id || (0, uuid_1.v4)();
        // Validate required fields
        if (!name) {
            return { error: 'Invalid agent registration: name is required' };
        }
        try {
            // Create the agent object
            const agent = {
                id: actualId,
                name,
                capabilities: capabilities || [],
                status: status || 'online',
                connectionId,
                registeredAt: new Date().toISOString(),
                manifest: manifest || (description ? { description } : undefined)
            };
            // Register the agent in the registry with the connection id
            this.agents.registerAgent(agent, connectionId);
            // Log the registration event
            logger_1.logger.agentToOrchestrator(`Agent registered successfully`, { agentName: name, agentId: actualId }, connectionId);
            // Emit event for agent registration
            // this.eventBus.emit('agent.registered', actualId, connectionId);
            return {
                id: actualId,
                agentId: actualId, // Include both formats for compatibility
                name,
                status,
                message: 'Agent successfully registered'
            };
        }
        catch (error) {
            logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, `Error registering agent`, error, connectionId);
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }
    // Helper method to send a message and wait for a response
    async sendAndWaitForResponse(agentId, message, options = {}) {
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
    stop() {
        if (this.server) {
            this.server.close(() => {
                logger_1.logger.system('Agent server stopped');
            });
        }
        if (this.wss) {
            this.wss.clients.forEach((ws) => {
                ws.terminate();
            });
            this.wss.close(() => {
                logger_1.logger.system('WebSocket server for agents stopped');
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
exports.default = AgentServer;
