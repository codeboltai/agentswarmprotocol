"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmClientSDK = void 0;
const events_1 = require("events");
const WebSocketClient_1 = require("./service/WebSocketClient");
const TaskManager_1 = require("./manager/TaskManager");
const AgentManager_1 = require("./manager/AgentManager");
const MCPManager_1 = require("./manager/MCPManager");
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
        // Store task listeners
        this.taskListeners = new Map();
        // Initialize WebSocket client
        this.wsClient = new WebSocketClient_1.WebSocketClient(config);
        // Initialize managers with the WebSocketClient
        this.agentManager = new AgentManager_1.AgentManager(this.wsClient);
        this.mcpManager = new MCPManager_1.MCPManager(this.wsClient);
        // Pass this instance to TaskManager for event listening
        this.taskManager = new TaskManager_1.TaskManager(this.wsClient, this);
        // Set up event forwarding
        this.wsClient.on('connected', () => {
            this.emit('connected');
        });
        this.wsClient.on('disconnected', () => {
            this.emit('disconnected');
        });
        this.wsClient.on('error', (error) => {
            this.emit('error', error);
        });
        // Set up central message handling
        this.wsClient.on('message', this.handleMessage.bind(this));
    }
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    handleMessage(message) {
        console.log(`SwarmClientSDK received message: ${JSON.stringify(message)}`);
        // Emit the raw message for anyone who wants to listen
        this.emit('raw-message', message);
        // Handle specific message types
        switch (message.type) {
            case 'orchestrator.welcome':
                if (message.content && message.content.clientId) {
                    this.clientId = message.content.clientId;
                }
                this.emit('welcome', message.content);
                break;
            case 'agent.list':
                this.emit('agent-list', message.content.agents);
                break;
            case 'mcp.server.list':
                this.emit('mcp-server-list', message.content.servers);
                break;
            case 'task.result':
                // Check if we have a registered listener for this task
                const taskId = message.content.taskId;
                const taskListener = this.taskListeners.get(taskId);
                if (taskListener) {
                    taskListener.resultHandler(message.content);
                }
                // Emit the event for others to listen
                this.emit('task-result', message.content);
                // Also emit task.update for backward compatibility with UI
                this.emit('task.update', message.content);
                break;
            case 'task.status':
                // Check if we have a registered listener for this task
                const statusTaskId = message.content.taskId;
                const statusListener = this.taskListeners.get(statusTaskId);
                if (statusListener && message.content.status === 'failed') {
                    statusListener.statusHandler(message.content);
                }
                this.emit('task-status', message.content);
                // Also emit task.update for backward compatibility with UI
                this.emit('task.update', message.content);
                break;
            case 'task.created':
                this.emit('task-created', message.content);
                break;
            case 'task.notification':
                this.emit('task-notification', message.content);
                break;
            case 'service.notification':
                this.emit('service-notification', message.content);
                break;
            case 'mcp.task.execution':
                this.emit('mcp.task.execution', message.content);
                break;
            case 'error':
                this.emit('orchestrator-error', message.content || { error: 'Unknown error' });
                break;
            default:
                console.log(`Unhandled message type: ${message.type}`);
                break;
        }
    }
    /**
     * Register task event listeners
     * @param taskId - The task ID to listen for
     * @param options - Handler and timeout options
     * @returns Cleanup function
     */
    registerTaskListeners(taskId, options) {
        const { resultHandler, statusHandler, timeout, timeoutCallback } = options;
        // Set timeout
        const timeoutId = setTimeout(() => {
            this.removeTaskListeners(taskId);
            timeoutCallback();
        }, timeout);
        // Store handlers
        this.taskListeners.set(taskId, {
            resultHandler,
            statusHandler,
            timeoutId
        });
        // Return cleanup function
        return () => this.removeTaskListeners(taskId);
    }
    /**
     * Remove task event listeners
     * @param taskId - The task ID to remove listeners for
     */
    removeTaskListeners(taskId) {
        const listeners = this.taskListeners.get(taskId);
        if (listeners && listeners.timeoutId) {
            clearTimeout(listeners.timeoutId);
        }
        this.taskListeners.delete(taskId);
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
        this.wsClient.clearPendingResponses();
        // Clear all task listeners
        for (const [taskId, listeners] of this.taskListeners.entries()) {
            if (listeners.timeoutId) {
                clearTimeout(listeners.timeoutId);
            }
        }
        this.taskListeners.clear();
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
    async sendRequestWaitForResponse(message, options = {}) {
        return this.wsClient.sendRequestWaitForResponse(message, options);
    }
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    async sendTask(agentName, taskData, options = {}) {
        return this.taskManager.sendTask(agentName, taskData, options);
    }
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status
     */
    async getTaskStatus(taskId) {
        return this.taskManager.getTaskStatus(taskId);
    }
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    async getAgentsList(filters = {}) {
        return this.agentManager.getAgentsList(filters);
    }
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    async listMCPServers(filters = {}) {
        return this.mcpManager.listMCPServers(filters);
    }
    /**
     * Get tools available on an MCP server
     * @param serverId - ID of the server to get tools for
     * @returns List of tools
     */
    async getMCPServerTools(serverId) {
        return this.mcpManager.getMCPServerTools(serverId);
    }
    /**
     * Execute a tool on an MCP server
     * @param serverId - ID of the server to execute the tool on
     * @param toolName - Name of the tool to execute
     * @param parameters - Tool parameters
     * @returns Tool execution result
     */
    async executeMCPTool(serverId, toolName, parameters) {
        return this.mcpManager.executeMCPTool(serverId, toolName, parameters);
    }
}
exports.SwarmClientSDK = SwarmClientSDK;
//# sourceMappingURL=index.js.map