"use strict";
/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmAgentSDK = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const WebSocketManager_1 = require("./core/WebSocketManager");
const InternalMessageHandler_1 = require("./handlers/InternalMessageHandler");
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
        this.messageHandler = new InternalMessageHandler_1.InternalMessageHandler(this.webSocketManager, this.logger);
        this.taskHandler = new TaskHandler_1.TaskHandler(this.webSocketManager, this.agentId, this.logger);
        this.agentManager = new AgentManager_1.AgentManager(this.webSocketManager, this.agentId, this.logger);
        this.serviceManager = new ServiceManager_1.ServiceManager(this.webSocketManager, this.logger);
        this.mcpManager = new MCPManager_1.MCPManager(this.webSocketManager, this.logger);
        // Set up event forwarding
        this.setupEventForwarding();
        // Handle special case for task.execute messages
        this.messageHandler.on('task.execute', (content, message) => {
            this.taskHandler.handleTask(message);
        });
    }
    /**
     * Set up event forwarding from the modules to this SDK instance
     */
    setupEventForwarding() {
        // Forward WebSocketManager events
        this.webSocketManager.on('connected', () => {
            // Register agent with orchestrator
            this.send({
                type: 'agent.register',
                content: {
                    name: this.name,
                    capabilities: this.capabilities,
                    manifest: this.manifest
                }
            })
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
        // Forward MessageHandler events
        this.messageHandler.on('welcome', (content) => this.emit('welcome', content));
        this.messageHandler.on('agent-request-accepted', (content) => this.emit('agent-request-accepted', content));
        this.messageHandler.on('agent-response', (content) => this.emit('agent-response', content));
        this.messageHandler.on('registered', (content) => this.emit('registered', content));
        this.messageHandler.on('service-response', (content) => this.emit('service-response', content));
        // Forward TaskHandler events
        this.taskHandler.on('task', (taskData, message) => this.emit('task', taskData, message));
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
    /**
     * Expose the handleMessage method (mainly for testing)
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message) {
        this.messageHandler.handleMessage(message);
    }
    /**
     * Register a message handler for a specific message type
     * @param messageType Type of message to handle
     * @param handler Handler function
     */
    onMessage(messageType, handler) {
        this.messageHandler.onMessage(messageType, handler);
        return this;
    }
    /**
     * Send a message during task execution
     * @param taskId ID of the task being executed
     * @param content Message content
     */
    sendMessage(taskId, content) {
        this.taskHandler.sendMessage(taskId, content);
    }
    /**
     * Register a task handler for a specific task type
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    registerTaskHandler(taskType, handler) {
        this.taskHandler.registerTaskHandler(taskType, handler);
        return this;
    }
    /**
     * Register a default task handler for when no specific handler is found
     * @param handler Handler function
     */
    registerDefaultTaskHandler(handler) {
        this.taskHandler.registerDefaultTaskHandler(handler);
        return this;
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
    //OK - low level send
    /**
     * Send a message to the orchestrator
     * @param message Message to send
     */
    send(message) {
        return this.webSocketManager.send(message);
    }
    //OK
    /**
     * Send a message and wait for a response
     * @param message Message to send
     * @param timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message, timeout = 30000) {
        return this.webSocketManager.sendAndWaitForResponse(message, timeout);
    }
    // Agent Manager methods
    /**
     * Request another agent to perform a task
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    requestAgentTask(targetAgentName, taskData, timeout = 30000) {
        return this.agentManager.requestAgentTask(targetAgentName, taskData, timeout);
    }
    //Ok
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    getAgentList(filters = {}) {
        return this.agentManager.getAgentList(filters);
    }
    //Should be for SELF Only
    /**
     * Set agent status
     * @param status New status
     */
    setStatus(status) {
        return this.agentManager.setStatus(status);
    }
    // NOT SURE WHAT IS THIS
    /**
     * Register a handler for agent requests
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    onAgentRequest(taskType, handler) {
        this.registerTaskHandler(taskType, handler);
        return this;
    }
    // Service Manager methods
    /**
     * Request a service
     * @param serviceName Name of the service
     * @param params Service parameters
     * @param timeout Request timeout
     */
    requestService(serviceName, params = {}, timeout = 30000) {
        return this.serviceManager.requestService(serviceName, params, timeout);
    }
    /**
     * Convenience method for executing a service
     * @param serviceName Name of the service
     * @param params Parameters to pass
     * @param timeout Request timeout
     */
    executeService(serviceName, params = {}, timeout = 30000) {
        return this.serviceManager.requestService(serviceName, params, timeout);
    }
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTask(serviceId, functionName, params = {}, options = {
        timeout: 30000,
        clientId: undefined
    }) {
        // First verify we have the serviceId
        if (!serviceId) {
            this.logger.error('executeServiceTask called with empty serviceId');
            return Promise.reject(new Error('Service ID is required for executing a service task'));
        }
        this.logger.debug(`Executing service task "${functionName}" on service "${serviceId}"`);
        try {
            return this.serviceManager.executeServiceTask(serviceId, functionName, params, options)
                .catch(error => {
                // Enhance error messages for better troubleshooting
                if (error.message.includes('Connection not found')) {
                    this.logger.error(`Service connection error: Unable to find service "${serviceId}". Make sure the service is running and connected.`);
                    throw new Error(`Service "${serviceId}" is not connected or does not exist. Please verify the service is running and properly registered.`);
                }
                // Handle other common errors
                if (error.message.includes('timed out')) {
                    this.logger.error(`Service task timed out: "${functionName}" on service "${serviceId}"`);
                    throw new Error(`Service task "${functionName}" timed out after ${options.timeout}ms. The service might be unresponsive.`);
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
