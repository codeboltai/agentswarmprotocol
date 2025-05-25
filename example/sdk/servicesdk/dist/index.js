"use strict";
/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmServiceSDK = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const WebSocketManager_1 = require("./core/WebSocketManager");
const TaskHandler_1 = require("./handlers/TaskHandler");
class SwarmServiceSDK extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        // Initialize properties
        // Use a consistent serviceId based on service name if not provided
        this.serviceId = config.serviceId || this.generateConsistentServiceId(config.name || 'generic-service');
        this.name = config.name || 'Generic Service';
        this.capabilities = config.capabilities || [];
        this.tools = new Map();
        this.description = config.description || 'Generic Service';
        this.manifest = config.manifest || {};
        this.logger = config.logger || console;
        // Initialize tools from config
        if (config.tools) {
            config.tools.forEach(tool => {
                this.tools.set(tool.id, tool);
            });
        }
        // Initialize modules
        this.webSocketManager = new WebSocketManager_1.WebSocketManager(config.orchestratorUrl || 'ws://localhost:3002', config.autoReconnect !== false, config.reconnectInterval || 5000, this.logger);
        this.taskHandler = new TaskHandler_1.TaskHandler(this.webSocketManager, this.serviceId, this.logger);
        // Set up event forwarding
        this.setupEventForwarding();
    }
    /**
     * Generate a consistent serviceId based on service name
     * @param serviceName The name of the service
     * @returns A consistent serviceId without spaces
     */
    generateConsistentServiceId(serviceName) {
        // Convert to lowercase, remove spaces and special characters, keep only alphanumeric and hyphens
        const cleanName = serviceName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        return cleanName || 'generic-service';
    }
    /**
     * Set up event forwarding from the modules to this SDK instance
     */
    setupEventForwarding() {
        // Forward WebSocketManager events
        this.webSocketManager.on('connected', () => {
            // Register service with orchestrator
            this.webSocketManager.send({
                type: 'service.register',
                content: {
                    id: this.serviceId,
                    name: this.name,
                    capabilities: this.capabilities,
                    tools: Array.from(this.tools.values()),
                    manifest: this.manifest
                }
            })
                .then(response => {
                // Store the assigned service ID if provided
                if (response && response.content && response.content.serviceId) {
                    this.serviceId = response.content.serviceId;
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
        this.webSocketManager.on('message', (message) => {
            // Emit for the specific message type
            this.emit(message.type, message.content, message);
            // For standard message types
            switch (message.type) {
                case 'orchestrator.welcome':
                    this.emit('welcome', message.content);
                    break;
                case 'service.registered':
                    this.emit('registered', message.content);
                    break;
                case 'notification.received':
                    this.emit('notification-received', message.content);
                    break;
                case 'ping':
                    this.webSocketManager.send({ type: 'pong', id: message.id, content: {} });
                    break;
                case 'error':
                    this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
                    break;
                case 'service.task.execute':
                    const taskMessage = message;
                    const taskId = taskMessage.id;
                    const toolId = taskMessage.content.toolId || taskMessage.content.functionName; // Support both for backward compatibility
                    // Get tool information
                    const tool = this.tools.get(toolId);
                    const toolName = tool ? tool.name : toolId;
                    // Emit 'started' notification
                    const startNotification = { taskId, message: `Starting tool: ${toolName}`, type: 'started', data: { toolId, toolName } };
                    this.emit('notification', startNotification);
                    this.sendTaskNotification(taskId, startNotification.message, startNotification.type, startNotification.data);
                    // Process the task
                    this.taskHandler.handleServiceTask(taskMessage)
                        .then(() => {
                        // Emit 'completed' notification
                        const completeNotification = { taskId, message: `Tool completed: ${toolName}`, type: 'completed', data: { toolId, toolName } };
                        this.emit('notification', completeNotification);
                        this.sendTaskNotification(taskId, completeNotification.message, completeNotification.type, completeNotification.data);
                    })
                        .catch((error) => {
                        // Emit 'failed' notification
                        const failedNotification = { taskId, message: `Tool failed: ${error.message}`, type: 'failed', data: { toolId, toolName, error: error.message } };
                        this.emit('notification', failedNotification);
                        this.sendTaskNotification(taskId, failedNotification.message, failedNotification.type, failedNotification.data);
                    });
                    break;
            }
        });
    }
    //OK
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect() {
        return this.webSocketManager.connect().then(() => this);
    }
    //OK
    /**
     * Disconnect from the orchestrator
     */
    disconnect() {
        this.webSocketManager.disconnect();
        return this;
    }
    //OK
    /**
     * Register a tool with its handler
     * @param {string} toolId Unique identifier for the tool
     * @param {ServiceTool} toolInfo Tool information
     * @param {Function} handler Function to call when tool is executed
     */
    registerTool(toolId, toolInfo, handler) {
        const tool = {
            id: toolId,
            ...toolInfo
        };
        this.tools.set(toolId, tool);
        this.taskHandler.onTask(toolId, handler);
        return this;
    }
    /**
     * Register a task handler (legacy API - now registers as a tool)
     * @param {string} toolId ID of the tool to handle
     * @param {Function} handler Function to call
     */
    onTask(toolId, handler) {
        // Auto-register as a tool if not already registered
        if (!this.tools.has(toolId)) {
            this.tools.set(toolId, {
                id: toolId,
                name: toolId,
                description: `Tool: ${toolId}`
            });
        }
        this.taskHandler.onTask(toolId, handler);
        return this;
    }
    /**
     * Get all registered tools
     * @returns Array of tools
     */
    getTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Get a specific tool by ID
     * @param toolId Tool ID
     * @returns Tool or undefined if not found
     */
    getTool(toolId) {
        return this.tools.get(toolId);
    }
    //Ok
    /**
     * Set service status
     * @param status New status
     * @param message Status message
     */
    async setStatus(status, message = '') {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.status',
            content: {
                serviceId: this.serviceId,
                status,
                message,
                timestamp: new Date().toISOString()
            }
        });
    }
    //OK
    /**
   * Send a task notification
   * @param taskId ID of the task
   * @param message Message content
   * @param notificationType Type of notification
   * @param data Additional data
   */
    async sendTaskNotification(taskId, message, notificationType = 'info', data = {}) {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.task.notification',
            content: {
                serviceId: this.serviceId,
                taskId,
                notification: {
                    type: notificationType,
                    message,
                    timestamp: new Date().toISOString(),
                    data
                }
            }
        });
    }
    //OK
    /**
     * Send a general notification to clients
     * @param notification Notification data
     */
    async sendClientInfoNotification(notification) {
        if (!notification.timestamp) {
            notification.timestamp = new Date().toISOString();
        }
        if (!notification.type) {
            notification.type = 'info';
        }
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.notification',
            content: {
                serviceId: this.serviceId,
                notification
            }
        });
    }
    //Ok
    /**
     * Send a notification to the orchestrator
     * @param notification Notification data
     */
    async sendOrchestratorNotification(notification) {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.notification',
            content: {
                serviceId: this.serviceId,
                notification
            }
        });
    }
}
exports.SwarmServiceSDK = SwarmServiceSDK;
exports.default = SwarmServiceSDK;
