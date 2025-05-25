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
        // Initialize WebSocket client
        this.wsClient = new WebSocketClient_1.WebSocketClient(config);
        // Initialize managers with the WebSocketClient
        this.agentManager = new AgentManager_1.AgentManager(this.wsClient);
        this.mcpManager = new MCPManager_1.MCPManager(this.wsClient);
        this.taskManager = new TaskManager_1.TaskManager(this.wsClient);
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
            case 'orchestrator.client.welcome':
                if (message.content && message.content.clientId) {
                    this.clientId = message.content.clientId;
                }
                this.emit('welcome', message.content);
                break;
            case 'client.agent.list.response':
                this.emit('agent.list', message.content.agents);
                break;
            case 'client.agent.task.result':
                this.emit('task.result', message.content);
                break;
            case 'task.error':
                this.emit('task.error', message.content);
                break;
            case 'client.agent.task.create.response':
                this.emit('task.created', message.content);
                break;
            case 'client.agent.task.status.response':
                this.emit('task.status', message.content);
                break;
            case 'task.notification':
                this.emit('task.notification', message.content);
                break;
            case 'task.requestmessage':
                this.emit('task.requestmessage', message.content);
                break;
            case 'task.childtask.created':
                this.emit('task.childtask.created', message.content);
                break;
            case 'task.childtask.status':
                this.emit('task.childtask.status', message.content);
                break;
            case 'service.started':
                this.emit('service.started', message.content);
                break;
            case 'service.notification':
                this.emit('service.notification', message.content);
                break;
            case 'service.completed':
                this.emit('service.completed', message.content);
                break;
            case 'client.mcp.server.list.response':
                this.emit('mcp.server.list', message.content.servers);
                break;
            case 'mcp.task.execution':
                this.emit('mcp.task.execution', message.content);
                break;
            case 'error':
                this.emit('error', message.content || { error: 'Unknown error' });
                break;
            default:
                console.log(`Unhandled message type: ${message.type}`);
                break;
        }
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
    async sendTask(agentId, agentName, taskData, options = {}) {
        return this.taskManager.sendTask(agentId, agentName, taskData, options);
    }
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    async getAgentsList(filters = {}) {
        return this.agentManager.getAgentsList(filters);
    }
    async sendMessageDuringTask(taskId, message) {
        return this.taskManager.sendMessageDuringTask(taskId, message);
    }
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status information including status, result, timestamps, etc.
     */
    async getTaskStatus(taskId) {
        return this.taskManager.getTaskStatus(taskId);
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