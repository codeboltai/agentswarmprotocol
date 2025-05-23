"use strict";
/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmAgentSDK = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const WebSocketManager_1 = require("./core/WebSocketManager");
const TaskHandler_1 = require("./handlers/TaskHandler");
const AgentManager_1 = require("./services/AgentManager");
const ServiceManager_1 = require("./services/ServiceManager");
const MCPManager_1 = require("./services/MCPManager");
class SwarmAgentSDK extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        // Initialize properties
        this.agentId = config.agentId || (0, uuid_1.v4)();
        this.name = config.name || 'Generic Agent';
        this.agentType = config.agentType || 'generic';
        this.capabilities = config.capabilities || [];
        this.description = config.description || 'Generic Agent';
        this.manifest = config.manifest || {};
        this.logger = config.logger || console;
        // Initialize modules
        this.webSocketManager = new WebSocketManager_1.WebSocketManager(config.orchestratorUrl || 'ws://localhost:3000', config.autoReconnect !== false, config.reconnectInterval || 5000, this.logger);
        this.taskHandler = new TaskHandler_1.TaskHandler(this.webSocketManager, this.agentId, this.logger);
        this.agentManager = new AgentManager_1.AgentManager(this.webSocketManager, this.agentId, this.logger);
        this.serviceManager = new ServiceManager_1.ServiceManager(this.webSocketManager, this.logger);
        this.mcpManager = new MCPManager_1.MCPManager(this.webSocketManager, this.logger);
        // Set up event forwarding
        this.setupEventForwarding();
    }
    /**
     * Set up event forwarding from the modules to this SDK instance
     */
    setupEventForwarding() {
        // Forward WebSocketManager events
        this.webSocketManager.on('connected', () => {
            // Register agent with orchestrator
            this.sendRegistration()
                .then(response => {
                // Store the assigned agent ID if provided
                if (response && response.content && response.content.agentId) {
                    this.agentId = response.content.agentId;
                }
                this.emit('registered', response.content);
            })
                .catch(err => {
                this.emit('error', new Error(`Failed to register: ${err.message}`));
            });
            this.emit('connected');
        });
        this.webSocketManager.on('disconnected', () => this.emit('disconnected'));
        this.webSocketManager.on('error', (error) => this.emit('error', error));
        // Message routing logic (replaces InternalMessageHandler)
        this.webSocketManager.on('message', (message) => {
            this.processMessage(message);
        });
        // Forward TaskHandler events
        this.taskHandler.on('task', (taskData, message) => this.emit('task', taskData, message));
    }
    /**
     * Send registration message to the orchestrator
     * @private
     */
    sendRegistration() {
        return this.webSocketManager.send({
            type: 'agent.register',
            content: {
                id: this.agentId,
                agentId: this.agentId,
                name: this.name,
                capabilities: this.capabilities,
                manifest: {
                    ...this.manifest,
                    id: this.agentId
                }
            }
        });
    }
    /**
     * Process an incoming message and route it appropriately
     * @param {BaseMessage} message The message to process
     * @private
     */
    processMessage(message) {
        this.emit('raw-message', message);
        // Check if this is a response to a pending request
        if (message.requestId && this.webSocketManager.getPendingResponses().has(message.requestId)) {
            const isError = message.type === 'error' || (message.content && message.content.error);
            this.webSocketManager.handleResponse(message.requestId, message, isError);
            return;
        }
        // Emit for the specific message type
        this.emit(message.type, message.content, message);
        // For standard message types
        switch (message.type) {
            case 'agent.registered':
                this.emit('registered', message.content);
                break;
            case 'orchestrator.welcome':
                this.emit('welcome', message.content);
            case 'agent.service.list.response':
                this.emit('agent.service.list.response ', message.content);
                break;
            case 'task.execute':
                this.taskHandler.handleTask(message);
                break;
            case 'task.messageresponse':
                this.emit('task.messageresponse', message.content);
                break;
            case 'childagent.request.accepted':
                this.emit('agent-request-accepted', message.content);
                break;
            case 'childagent.response':
                this.emit('childagent.response', message.content);
                break;
            case 'service.request.accepted':
                this.emit('service-request-accepted', message.content);
                break;
            case 'service.response':
                this.emit('service-response', message.content);
                break;
            case 'ping':
                this.sendPong(message.id);
                break;
            case 'error':
                this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
                break;
            case 'mcp.servers.list':
                try {
                    // Handle different response formats
                    const servers = message.content.servers || message.content;
                    if (!Array.isArray(servers)) {
                        this.logger.warn('Received mcp.servers.list without proper servers array', message.content);
                        this.emit('mcp-servers-list', []);
                    }
                    else {
                        this.emit('mcp-servers-list', servers);
                    }
                }
                catch (error) {
                    this.logger.error('Error handling mcp.servers.list message:', error);
                    this.emit('mcp-servers-list', []);
                }
                break;
            case 'mcp.tools.list':
                try {
                    // Handle different response formats
                    const tools = message.content.tools || message.content;
                    if (!Array.isArray(tools)) {
                        this.logger.warn('Received mcp.tools.list without proper tools array', message.content);
                        this.emit('mcp-tools-list', []);
                    }
                    else {
                        this.emit('mcp-tools-list', tools);
                    }
                }
                catch (error) {
                    this.logger.error('Error handling mcp.tools.list message:', error);
                    this.emit('mcp-tools-list', []);
                }
                break;
            case 'mcp.tool.execution.result':
                try {
                    // Handle different response formats
                    const result = message.content.result !== undefined ? message.content.result : message.content;
                    this.emit('mcp-tool-execution-result', result);
                }
                catch (error) {
                    this.logger.error('Error handling mcp.tool.execution.result message:', error);
                    this.emit('mcp-tool-execution-result', null);
                }
                break;
            default:
                this.logger.debug(`Unhandled message type: ${message.type}`);
                break;
        }
    }
    /**
     * Send a pong response for the given messageId
     * @private
     */
    sendPong(messageId) {
        this.webSocketManager.send({
            type: 'pong',
            id: messageId,
            content: {}
        });
    }
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect() {
        return this.webSocketManager.connect().then(() => this);
    }
    /**
     * Disconnect from the orchestrator
     */
    disconnect() {
        this.webSocketManager.disconnect();
        return this;
    }
    //Ok
    /**
     * Set agent status
     * @param status New status
     */
    setStatus(status) {
        return this.agentManager.setStatus(status);
    }
    // System Level Messages between Agent And Orchestrator
    // Task Level Communication between Agent And Orchestrator
    /**
     * Send a request message and wait for a response
     * @param message - The message to send
     * @param options - Additional options
     * @param options.timeout - Timeout in milliseconds
     * @returns The response message
     */
    async sendRequestWaitForResponse(message, options = {}) {
        return this.webSocketManager.sendRequestWaitForResponse(message, options);
    }
    /**
     * Register a task handler that will be called whenever a task is received
     * @param handler Task handler function
     */
    onTask(handler) {
        this.taskHandler.onTask(handler);
        return this;
    }
    //Ok
    /**
     * Send a message during task execution
     * @param taskId ID of the task being executed
     * @param content Message content
     */
    sendTaskMessage(taskId, content) {
        this.taskHandler.sendTaskMessage(taskId, content);
    }
    //OK
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId, result) {
        this.taskHandler.sendTaskResult(taskId, result);
    }
    //OK
    /**
     * Send a request message during task execution and wait for a response
     * @param taskId ID of the task being executed
     * @param content Request content
     * @param timeout Timeout in milliseconds
     * @returns Promise that resolves with the response content
     */
    requestMessageDuringTask(taskId, content, timeout = 30000) {
        return this.taskHandler.requestMessageDuringTask(taskId, content, timeout);
    }
    // Child Agent Management through Orchestrator
    //OK
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    getAgentList(filters = {}) {
        return this.agentManager.getAgentList(filters);
    }
    //OK
    /**
     * Request another agent to perform a task
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    executeChildAgentTask(targetAgentName, taskData, timeout = 30000) {
        return this.agentManager.executeChildAgentTask(targetAgentName, taskData, timeout);
    }
    // Service Manager methods
    //OK  
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTask(serviceId, toolName, params = {}, options = {
        timeout: 30000,
        clientId: undefined
    }) {
        // First verify we have the serviceId
        if (!serviceId) {
            this.logger.error('executeServiceTask called with empty serviceId');
            return Promise.reject(new Error('Service ID is required for executing a service task'));
        }
        this.logger.debug(`Executing service task "${toolName}" on service "${serviceId}"`);
        try {
            return this.serviceManager.executeServiceTask(serviceId, toolName, params, options)
                .catch(error => {
                // Enhance error messages for better troubleshooting
                if (error.message.includes('Connection not found')) {
                    this.logger.error(`Service connection error: Unable to find service "${serviceId}". Make sure the service is running and connected.`);
                    throw new Error(`Service "${serviceId}" is not connected or does not exist. Please verify the service is running and properly registered.`);
                }
                // Handle other common errors
                if (error.message.includes('timed out')) {
                    this.logger.error(`Service task timed out: "${toolName}" on service "${serviceId}"`);
                    throw new Error(`Service task "${toolName}" timed out after ${options.timeout}ms. The service might be unresponsive.`);
                }
                // Pass through other errors
                throw error;
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to execute service task: ${errorMessage}`);
            return Promise.reject(error instanceof Error ? error : new Error(errorMessage));
        }
    }
    //OK
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    getServiceList(filters = {}) {
        return this.serviceManager.getServiceList(filters);
    }
    //Ok
    /**
     * Get a list of tools for a specific service
     * @param serviceId Service ID or name
     * @param options Optional parameters (e.g., timeout)
     */
    getServiceToolList(serviceId, options = {}) {
        return this.serviceManager.getServiceToolList(serviceId, options);
    }
    // MCP Manager methods
    //OK
    /**
     * Get list of MCP servers
     * @param filters Filter criteria
     * @param timeout Request timeout
     */
    getMCPServers(filters = {}, timeout = 30000) {
        return this.mcpManager.getMCPServers(filters, timeout);
    }
    //OK
    /**
     * Get list of tools for an MCP server
     * @param serverId Server ID
     * @param timeout Request timeout
     */
    getMCPTools(serverId, timeout = 30000) {
        return this.mcpManager.getMCPTools(serverId, timeout);
    }
    //OK
    /**
     * Execute an MCP tool
     * @param serverId Server ID
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param timeout Request timeout
     */
    executeMCPTool(serverId, toolName, parameters = {}, timeout = 60000) {
        return this.mcpManager.executeMCPTool(serverId, toolName, parameters, timeout);
    }
}
exports.SwarmAgentSDK = SwarmAgentSDK;
exports.default = SwarmAgentSDK;
