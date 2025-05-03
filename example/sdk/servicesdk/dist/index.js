"use strict";
/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmServiceSDK = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const WebSocketManager_1 = require("./core/WebSocketManager");
const MessageHandler_1 = require("./handlers/MessageHandler");
const TaskHandler_1 = require("./handlers/TaskHandler");
const NotificationManager_1 = require("./services/NotificationManager");
const StatusManager_1 = require("./services/StatusManager");
class SwarmServiceSDK extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        // Initialize properties
        this.serviceId = config.serviceId || (0, uuid_1.v4)();
        this.name = config.name || 'Generic Service';
        this.capabilities = config.capabilities || [];
        this.description = config.description || 'Generic Service';
        this.manifest = config.manifest || {};
        this.logger = config.logger || console;
        // Initialize modules
        this.webSocketManager = new WebSocketManager_1.WebSocketManager(config.orchestratorUrl || 'ws://localhost:3002', config.autoReconnect !== false, config.reconnectInterval || 5000, this.logger);
        this.messageHandler = new MessageHandler_1.MessageHandler(this.webSocketManager, this.logger);
        this.taskHandler = new TaskHandler_1.TaskHandler(this.webSocketManager, this.serviceId, this.logger);
        this.notificationManager = new NotificationManager_1.NotificationManager(this.webSocketManager, this.serviceId, this.logger);
        this.statusManager = new StatusManager_1.StatusManager(this.webSocketManager, this.serviceId, this.logger);
        // Set up event forwarding
        this.setupEventForwarding();
        // Handle special case for task execution messages
        this.messageHandler.on('service.task.execute', (content, message) => {
            this.taskHandler.handleServiceTask(message);
        });
        // Forward task notification events
        this.taskHandler.on('notification', (notification) => {
            this.emit('notification', notification);
        });
    }
    /**
     * Set up event forwarding from the modules to this SDK instance
     */
    setupEventForwarding() {
        // Forward WebSocketManager events
        this.webSocketManager.on('connected', () => {
            // Register service with orchestrator
            this.send({
                type: 'service.register',
                content: {
                    name: this.name,
                    capabilities: this.capabilities,
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
        // Forward MessageHandler events
        this.messageHandler.on('welcome', (content) => this.emit('welcome', content));
        this.messageHandler.on('registered', (content) => this.emit('registered', content));
        this.messageHandler.on('notification-received', (content) => this.emit('notification-received', content));
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
     * Register a task handler (new API style)
     * @param {string} taskName Name of the task to handle
     * @param {Function} handler Function to call
     */
    onTask(taskName, handler) {
        this.taskHandler.onTask(taskName, handler);
        return this;
    }
    /**
     * Register a function handler (legacy API, kept for compatibility)
     * @param {string} functionName Name of the function to handle
     * @param {Function} handler Function to call
     * @deprecated Use onTask instead
     */
    registerFunction(functionName, handler) {
        return this.onTask(functionName, handler);
    }
    /**
     * Handle incoming messages (exposed mainly for testing)
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message) {
        this.messageHandler.handleMessage(message);
    }
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId, result) {
        this.taskHandler.sendTaskResult(taskId, result);
    }
    /**
     * Send a task notification
     * @param taskId ID of the task
     * @param message Message content
     * @param notificationType Type of notification
     * @param data Additional data
     */
    async sendTaskNotification(taskId, message, notificationType = 'info', data = {}) {
        await this.taskHandler.sendTaskNotification(taskId, message, notificationType, data);
    }
    /**
     * Send a general notification to clients
     * @param notification Notification data
     */
    async notify(notification) {
        await this.notificationManager.notify(notification);
    }
    /**
     * Send a notification to the orchestrator
     * @param notification Notification data
     */
    async sendNotification(notification) {
        await this.notificationManager.sendNotification(notification);
    }
    /**
     * Send a message to the orchestrator
     * @param message Message to send
     */
    send(message) {
        return this.webSocketManager.send(message);
    }
    /**
     * Send a message and wait for a response
     * @param message Message to send
     * @param timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message, timeout = 30000) {
        return this.webSocketManager.sendAndWaitForResponse(message, timeout);
    }
    /**
     * Set service status
     * @param status New status
     * @param message Status message
     */
    async setStatus(status, message = '') {
        await this.statusManager.setStatus(status, message);
    }
}
exports.SwarmServiceSDK = SwarmServiceSDK;
exports.default = SwarmServiceSDK;
