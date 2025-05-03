"use strict";
/**
 * SwarmAgentSDK - Base class for creating agents that connect to the Agent Swarm Protocol
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmAgentSDK = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const uuid_1 = require("uuid");
class SwarmAgentSDK extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.agentId = config.agentId || (0, uuid_1.v4)();
        this.name = config.name || 'Generic Agent';
        this.agentType = config.agentType || 'generic';
        this.capabilities = config.capabilities || [];
        this.description = config.description || 'Generic Agent';
        this.manifest = config.manifest || {};
        this.orchestratorUrl = config.orchestratorUrl || 'ws://localhost:3000';
        this.autoReconnect = config.autoReconnect !== false;
        this.reconnectInterval = config.reconnectInterval || 5000;
        this.connected = false;
        this.connecting = false;
        this.pendingResponses = new Map();
        this.messageHandlers = new Map();
        this.taskHandlers = new Map(); // Keep for backward compatibility
        this.ws = null;
        // Set up basic logger
        this.logger = config.logger || console;
    }
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect() {
        if (this.connected || this.connecting) {
            return Promise.resolve(this);
        }
        this.connecting = true;
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(this.orchestratorUrl);
                this.ws.on('open', () => {
                    this.connected = true;
                    this.connecting = false;
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
                    resolve(this);
                });
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    }
                    catch (err) {
                        const error = err;
                        this.emit('error', new Error(`Failed to parse message: ${error.message}`));
                    }
                });
                this.ws.on('error', (error) => {
                    this.emit('error', error);
                    if (this.connecting) {
                        this.connecting = false;
                        reject(error);
                    }
                });
                this.ws.on('close', () => {
                    this.connected = false;
                    this.connecting = false;
                    this.emit('disconnected');
                    if (this.autoReconnect) {
                        setTimeout(() => {
                            this.connect().catch(err => {
                                this.emit('error', new Error(`Reconnection failed: ${err.message}`));
                            });
                        }, this.reconnectInterval);
                    }
                });
            }
            catch (err) {
                this.connecting = false;
                reject(err);
            }
        });
    }
    /**
     * Disconnect from the orchestrator
     */
    disconnect() {
        if (this.ws) {
            this.autoReconnect = false;
            this.ws.close();
        }
        return this;
    }
    /**
     * Handle incoming messages
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message) {
        this.emit('message', message);
        if (message.requestId && this.pendingResponses.has(message.requestId)) {
            const { resolve, reject, timer } = this.pendingResponses.get(message.requestId);
            clearTimeout(timer);
            this.pendingResponses.delete(message.requestId);
            if (message.type === 'error' || (message.content && message.content.error)) {
                reject(new Error(message.content ? message.content.error : 'Unknown error'));
            }
            else {
                resolve(message);
            }
            return;
        }
        // Handle task.execute specially to extract the task type
        if (message.type === 'task.execute') {
            this.handleTask(message);
            return;
        }
        // Emit for the specific message type
        this.emit(message.type, message.content, message);
        // For standard message types
        switch (message.type) {
            case 'orchestrator.welcome':
                this.emit('welcome', message.content);
                break;
            case 'agent.request.accepted':
                this.emit('agent-request-accepted', message.content);
                break;
            case 'agent.response':
                this.emit('agent-response', message.content);
                break;
            case 'agent.registered':
                this.emit('registered', message.content);
                break;
            case 'service.response':
                this.emit('service-response', message.content);
                break;
            case 'ping':
                this.send({ type: 'pong', id: message.id, content: {} });
                break;
            case 'error':
                this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
                break;
            // MCP message types
            case 'mcp.servers.list':
                this.emit('mcp-servers-list', message.content);
                break;
            case 'mcp.tools.list':
                this.emit('mcp-tools-list', message.content);
                break;
            case 'mcp.tool.execution.result':
                this.emit('mcp-tool-execution-result', message.content);
                break;
        }
    }
    /**
     * Register a message handler for a specific message type
     * New simplified API for message handling
     * @param messageType Type of message to handle
     * @param handler Handler function
     */
    onMessage(messageType, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.messageHandlers.set(messageType, handler);
        // Also set up the event listener
        this.on(messageType, (content, message) => handler(content, message));
        return this; // For chaining
    }
    /**
     * Convenience method for executing a service
     * @param serviceName Name of the service
     * @param params Parameters to pass
     * @param timeout Request timeout
     */
    async executeService(serviceName, params = {}, timeout = 30000) {
        return this.requestService(serviceName, params, timeout);
    }
    /**
     * Send a task message during execution
     * @param taskId ID of the task being executed
     * @param content Message content
     */
    sendMessage(taskId, content) {
        this.send({
            id: (0, uuid_1.v4)(),
            type: 'task.notification',
            taskId,
            content
        });
    }
    /**
     * Register a task handler for a specific task type
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    registerTaskHandler(taskType, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.taskHandlers.set(taskType, handler);
        return this; // For chaining
    }
    /**
     * Register a default task handler for when no specific handler is found
     * @param handler Handler function
     */
    registerDefaultTaskHandler(handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.taskHandlers.set('*', handler);
        return this; // For chaining
    }
    /**
     * Handle an incoming task
     * @param message Task execution message
     */
    async handleTask(message) {
        const taskId = message.id;
        const taskData = message.content;
        const taskType = taskData.taskType || 'default';
        try {
            // First look for a type-specific handler
            let handler = this.taskHandlers.get(taskType);
            // If not found, try the default handler
            if (!handler) {
                handler = this.taskHandlers.get('*');
            }
            if (!handler) {
                // No handler registered, send error response
                this.sendTaskResult(taskId, {
                    error: `No handler registered for task type: ${taskType}`
                });
                return;
            }
            // Set initial task status to in progress
            this.sendTaskNotification({
                taskId,
                level: 'info',
                message: `Starting task: ${taskType}`,
                status: 'in_progress'
            });
            // Execute the handler
            const result = await handler(taskData, message);
            // Send the result
            this.sendTaskResult(taskId, result);
        }
        catch (error) {
            // Handle errors
            const err = error;
            this.logger.error(`Error handling task ${taskType}:`, err);
            // Send error notification
            this.sendTaskNotification({
                taskId,
                level: 'error',
                message: `Error executing task: ${err.message}`,
                error: err.message,
                stack: err.stack,
                status: 'error'
            });
            // Send error result
            this.sendTaskResult(taskId, {
                error: err.message,
                stack: err.stack
            });
        }
    }
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId, result) {
        // Ensure result is an object
        const resultObj = typeof result === 'object' ? result : { result };
        // Convert errors to a standard format
        if (result instanceof Error) {
            resultObj.error = result.message;
            resultObj.stack = result.stack;
            delete resultObj.result;
        }
        // Send the result message
        this.send({
            id: (0, uuid_1.v4)(),
            type: 'task.result',
            taskId,
            requestId: taskId, // For backward compatibility
            content: resultObj
        });
    }
    /**
     * Send a message to the orchestrator
     * @param message Message to send
     */
    send(message) {
        if (!this.connected || !this.ws) {
            return Promise.reject(new Error('Not connected to orchestrator'));
        }
        // Ensure message has an ID
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        // Add timestamp if not present
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }
        // Convert message to string
        const messageString = JSON.stringify(message);
        // Send to orchestrator
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                reject(new Error('Not connected to orchestrator'));
                return;
            }
            this.ws.send(messageString, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                // For messages that don't expect a response
                if (!['agent.register', 'service.request', 'mcp.servers.list.request',
                    'mcp.tools.list.request', 'mcp.tool.execute.request',
                    'agent.list.request', 'agent.task.request'].includes(message.type)) {
                    resolve(message);
                }
            });
        });
    }
    /**
     * Send a message and wait for a response
     * @param message Message to send
     * @param timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message, timeout = 30000) {
        if (!this.connected || !this.ws) {
            return Promise.reject(new Error('Not connected to orchestrator'));
        }
        // Ensure message has an ID
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        // Add timestamp if not present
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }
        // Convert message to string
        const messageString = JSON.stringify(message);
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                reject(new Error('Not connected to orchestrator'));
                return;
            }
            // Set up timeout
            const timer = setTimeout(() => {
                if (this.pendingResponses.has(message.id)) {
                    this.pendingResponses.delete(message.id);
                    reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
                }
            }, timeout);
            // Store the promise handlers
            this.pendingResponses.set(message.id, { resolve, reject, timer });
            // Send the message
            this.ws.send(messageString, (error) => {
                if (error) {
                    clearTimeout(timer);
                    this.pendingResponses.delete(message.id);
                    reject(error);
                }
            });
        });
    }
    /**
     * Request another agent to perform a task
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    async requestAgentTask(targetAgentName, taskData, timeout = 30000) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'agent.task.request',
            content: {
                targetAgentName,
                taskType: taskData.taskType || 'default',
                taskData,
                timeout
            }
        };
        const response = await this.sendAndWaitForResponse(message, timeout);
        return response.content;
    }
    /**
     * Request a service
     * @param serviceName Name of the service
     * @param params Service parameters
     * @param timeout Request timeout
     */
    async requestService(serviceName, params = {}, timeout = 30000) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'service.request',
            content: {
                service: serviceName,
                params
            }
        };
        const response = await this.sendAndWaitForResponse(message, timeout);
        return response.content;
    }
    /**
     * Request MCP service
     * @param params Service parameters
     * @param timeout Request timeout
     * @deprecated Use getMCPServers, getMCPTools, and executeMCPTool instead
     */
    async requestMCPService(params = {}, timeout = 30000) {
        this.logger.warn('requestMCPService is deprecated. Use getMCPServers, getMCPTools, and executeMCPTool instead.');
        return this.requestService('mcp', params, timeout);
    }
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    async getAgentList(filters = {}) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'agent.list.request',
            content: { filters }
        };
        const response = await this.sendAndWaitForResponse(message);
        return response.content.agents || [];
    }
    /**
     * Set agent status
     * @param status New status
     */
    async setStatus(status) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'agent.status.update',
            content: {
                status
            }
        };
        await this.send(message);
    }
    /**
     * Get list of MCP servers
     * @param filters Filter criteria
     * @param timeout Request timeout
     */
    async getMCPServers(filters = {}, timeout = 30000) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'mcp.servers.list.request',
            content: { filters }
        };
        try {
            const response = await this.sendAndWaitForResponse(message, timeout);
            return response.content.servers || [];
        }
        catch (error) {
            this.logger.error('Error fetching MCP servers:', error);
            throw error;
        }
    }
    /**
     * Get list of tools for an MCP server
     * @param serverId Server ID
     * @param timeout Request timeout
     */
    async getMCPTools(serverId, timeout = 30000) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'mcp.tools.list.request',
            content: { serverId }
        };
        try {
            const response = await this.sendAndWaitForResponse(message, timeout);
            return response.content.tools || [];
        }
        catch (error) {
            this.logger.error(`Error fetching MCP tools for server ${serverId}:`, error);
            throw error;
        }
    }
    /**
     * Execute an MCP tool
     * @param serverId Server ID
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param timeout Request timeout
     */
    async executeMCPTool(serverId, toolName, parameters = {}, timeout = 60000) {
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'mcp.tool.execute.request',
            content: {
                serverId,
                toolName,
                parameters,
                timeout
            }
        };
        try {
            const response = await this.sendAndWaitForResponse(message, timeout);
            if (response.content.status === 'error') {
                throw new Error(response.content.error || 'Unknown error during tool execution');
            }
            return response.content.result;
        }
        catch (error) {
            this.logger.error(`Error executing MCP tool ${toolName} on server ${serverId}:`, error);
            throw error;
        }
    }
    /**
     * Execute a tool by name (will find server automatically)
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param serverId Optional server ID (if known)
     * @param timeout Request timeout
     */
    async executeTool(toolName, parameters = {}, serverId = null, timeout = 60000) {
        // If server ID is provided, directly execute the tool
        if (serverId) {
            return this.executeMCPTool(serverId, toolName, parameters, timeout);
        }
        // Otherwise, get servers and find one with the tool
        const servers = await this.getMCPServers();
        // Try each server
        for (const server of servers) {
            try {
                const tools = await this.getMCPTools(server.id);
                const hasTool = tools.some(tool => tool.name === toolName);
                if (hasTool) {
                    return this.executeMCPTool(server.id, toolName, parameters, timeout);
                }
            }
            catch (error) {
                this.logger.warn(`Error checking tools on server ${server.id}:`, error);
                // Continue to the next server
            }
        }
        throw new Error(`Tool '${toolName}' not found on any available MCP server`);
    }
    /**
     * Execute a task on another agent
     * @param targetAgentName Name of the target agent
     * @param taskType Type of task
     * @param taskData Task data
     * @param timeout Request timeout
     */
    async executeAgentTask(targetAgentName, taskType, taskData = {}, timeout = 30000) {
        // Combine task type and data
        const fullTaskData = {
            ...taskData,
            taskType
        };
        return this.requestAgentTask(targetAgentName, fullTaskData, timeout);
    }
    /**
     * Register a handler for agent requests
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    onAgentRequest(taskType, handler) {
        return this.registerTaskHandler(taskType, handler);
    }
    /**
     * Send a task notification
     * @param notification Notification data
     */
    async sendTaskNotification(notification) {
        if (!notification.taskId) {
            throw new Error('Task ID is required for notifications');
        }
        const taskId = notification.taskId;
        delete notification.taskId;
        const notificationMessage = {
            id: (0, uuid_1.v4)(),
            type: 'task.notification',
            taskId,
            content: {
                ...notification,
                // Add timestamp if not present
                timestamp: notification.timestamp || new Date().toISOString(),
                // Default to info level if not specified
                level: notification.level || 'info'
            }
        };
        try {
            await this.send(notificationMessage);
        }
        catch (error) {
            this.logger.error('Error sending notification:', error);
            throw error;
        }
    }
    /**
     * Register a handler for notifications
     * @param handler Handler function
     */
    onNotification(handler) {
        // Listen for service notifications
        const wrappedHandler = (message) => {
            if (message && message.content) {
                handler({
                    ...message.content,
                    taskId: message.taskId || message.content.taskId
                });
            }
        };
        this.on('service.notification', wrappedHandler);
        return this;
    }
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    async executeServiceTask(serviceId, functionName, params = {}, options = {}) {
        const timeout = options.timeout || 30000;
        // Build the service request
        const message = {
            id: (0, uuid_1.v4)(),
            type: 'service.request',
            content: {
                service: serviceId,
                params: {
                    functionName,
                    ...params
                }
            }
        };
        // If notifications are requested, set up a handler
        if (options.onNotification) {
            // Create a unique ID for this specific handler
            const handlerId = `service-notification-${message.id}`;
            // Set up notification handler
            const resultHandler = (notificationMessage) => {
                const notification = notificationMessage.content;
                // Check if this notification is for our task
                if (notification && notification.taskId === message.id) {
                    options.onNotification(notification);
                    // If the task is completed or failed, remove the handler
                    if (notification.status === 'completed' || notification.status === 'failed') {
                        this.removeListener('service.notification', resultHandler);
                    }
                }
            };
            // Listen for service notifications
            this.on('service.notification', resultHandler);
            // Set up a timeout to clean up the listener if needed
            setTimeout(() => {
                this.removeListener('service.notification', resultHandler);
            }, timeout + 1000);
        }
        // Send the request
        try {
            const response = await this.sendAndWaitForResponse(message, timeout);
            return response.content;
        }
        catch (error) {
            this.logger.error(`Error executing service task ${functionName} on ${serviceId}:`, error);
            throw error;
        }
    }
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    async getServiceList(filters = {}) {
        const response = await this.requestService('orchestrator', {
            action: 'getServiceList',
            filters
        });
        return response.services || [];
    }
}
exports.SwarmAgentSDK = SwarmAgentSDK;
exports.default = SwarmAgentSDK;
