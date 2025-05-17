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
        this.serviceId = config.serviceId || (0, uuid_1.v4)();
        this.name = config.name || 'Generic Service';
        this.capabilities = config.capabilities || [];
        this.description = config.description || 'Generic Service';
        this.manifest = config.manifest || {};
        this.logger = config.logger || console;
        // Initialize modules
        this.webSocketManager = new WebSocketManager_1.WebSocketManager(config.orchestratorUrl || 'ws://localhost:3002', config.autoReconnect !== false, config.reconnectInterval || 5000, this.logger);
        this.taskHandler = new TaskHandler_1.TaskHandler(this.webSocketManager, this.serviceId, this.logger);
        // Set up event forwarding
        this.setupEventForwarding();
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
                    const functionName = taskMessage.content.functionName;
                    // Emit 'started' notification
                    const startNotification = { taskId, message: `Starting task: ${functionName}`, type: 'started', data: {} };
                    this.emit('notification', startNotification);
                    this.sendTaskNotification(taskId, startNotification.message, startNotification.type, startNotification.data);
                    // Process the task
                    this.taskHandler.handleServiceTask(taskMessage)
                        .then(() => {
                        // Emit 'completed' notification
                        const completeNotification = { taskId, message: `Task completed: ${functionName}`, type: 'completed', data: {} };
                        this.emit('notification', completeNotification);
                        this.sendTaskNotification(taskId, completeNotification.message, completeNotification.type, completeNotification.data);
                    })
                        .catch((error) => {
                        // Emit 'failed' notification
                        const failedNotification = { taskId, message: `Task failed: ${error.message}`, type: 'failed', data: { error: error.message } };
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
     * Register a task handler (new API style)
     * @param {string} taskName Name of the task to handle
     * @param {Function} handler Function to call
     */
    onTask(taskName, handler) {
        this.taskHandler.onTask(taskName, handler);
        return this;
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
