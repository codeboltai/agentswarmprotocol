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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPManager = exports.AgentManager = exports.TaskManager = exports.MessageHandler = exports.WebSocketClient = exports.SwarmClientSDK = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const WebSocketClient_1 = require("./WebSocketClient");
Object.defineProperty(exports, "WebSocketClient", { enumerable: true, get: function () { return WebSocketClient_1.WebSocketClient; } });
const MessageHandler_1 = require("./MessageHandler");
Object.defineProperty(exports, "MessageHandler", { enumerable: true, get: function () { return MessageHandler_1.MessageHandler; } });
const TaskManager_1 = require("./TaskManager");
Object.defineProperty(exports, "TaskManager", { enumerable: true, get: function () { return TaskManager_1.TaskManager; } });
const AgentManager_1 = require("./AgentManager");
Object.defineProperty(exports, "AgentManager", { enumerable: true, get: function () { return AgentManager_1.AgentManager; } });
const MCPManager_1 = require("./MCPManager");
Object.defineProperty(exports, "MCPManager", { enumerable: true, get: function () { return MCPManager_1.MCPManager; } });
/**
 * SwarmClientSDK - Client SDK for Agent Swarm Protocol
 * Handles client-side communication with the orchestrator
 */
class SwarmClientSDK extends events_1.EventEmitter {
    /**
     * Create a new SwarmClientSDK instance
     * @param config - Configuration options
     */
    constructor(config = {}) {
        super();
        this.clientId = null;
        this.defaultTimeout = config.defaultTimeout || 30000;
        // Initialize WebSocket client
        this.wsClient = new WebSocketClient_1.WebSocketClient(config);
        // Initialize message handler
        this.messageHandler = new MessageHandler_1.MessageHandler();
        // Initialize managers
        this.tasks = new TaskManager_1.TaskManager(this.sendRequest.bind(this));
        this.agents = new AgentManager_1.AgentManager(this.sendRequest.bind(this));
        this.mcp = new MCPManager_1.MCPManager(this.sendRequest.bind(this));
        // Set up event forwarding
        this.wsClient.on('message', async (message) => {
            await this.messageHandler.handleMessage(message);
        });
        this.wsClient.on('connected', () => {
            this.emit('connected');
        });
        this.wsClient.on('disconnected', () => {
            this.emit('disconnected');
        });
        this.wsClient.on('error', (error) => {
            this.emit('error', error);
        });
        // Forward events from message handler
        this.messageHandler.on('welcome', (content) => {
            if (content.clientId) {
                this.clientId = content.clientId;
                this.wsClient.setClientId(content.clientId);
            }
            this.emit('welcome', content);
        });
        // Set up event forwarding for task manager
        this.tasks.registerEventListeners(this.messageHandler);
        // Set up event forwarding for agent manager
        this.agents.registerEventListeners(this.messageHandler);
        // Set up event forwarding for MCP manager
        this.mcp.registerEventListeners(this.messageHandler);
        // Forward remaining events
        this.messageHandler.on('orchestrator-error', (error) => {
            this.emit('orchestrator-error', error);
        });
    }
    /**
     * Connect to the orchestrator
     * @returns Promise that resolves when connected
     */
    async connect() {
        return this.wsClient.connect();
    }
    /**
     * Disconnect from the orchestrator
     */
    disconnect() {
        this.wsClient.disconnect();
        this.messageHandler.clearPendingResponses();
    }
    /**
     * Check if connected to the orchestrator
     * @returns Whether the client is connected
     */
    isConnected() {
        return this.wsClient.isConnected();
    }
    /**
     * Get the client ID
     * @returns The client ID or null if not connected
     */
    getClientId() {
        return this.clientId;
    }
    /**
     * Send a request to the orchestrator
     * @param message - The message to send
     * @param options - Additional options
     * @returns The response message
     */
    async sendRequest(message, options = {}) {
        // Set message ID if not set
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        // Set timestamp if not set
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }
        // Wait for response
        return this.messageHandler.waitForResponse(message, (msg) => this.wsClient.send(msg), { timeout: options.timeout || this.defaultTimeout });
    }
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    async sendTask(agentName, taskData, options = {}) {
        return this.tasks.sendTask(agentName, taskData, options);
    }
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    async getAgents(filters = {}) {
        return this.agents.getAgents(filters);
    }
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    async listMCPServers(filters = {}) {
        return this.mcp.listMCPServers(filters);
    }
}
exports.SwarmClientSDK = SwarmClientSDK;
__exportStar(require("./WebSocketClient"), exports);
__exportStar(require("./MessageHandler"), exports);
__exportStar(require("./TaskManager"), exports);
__exportStar(require("./AgentManager"), exports);
__exportStar(require("./MCPManager"), exports);
//# sourceMappingURL=index.js.map