"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmServiceSDK = void 0;
/**
 * SwarmServiceSDK - Base class for creating services that connect to the Agent Swarm Protocol
 */
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const uuid_1 = require("uuid");
class SwarmServiceSDK extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.serviceId = config.serviceId || (0, uuid_1.v4)();
        this.name = config.name || 'Generic Service';
        this.capabilities = config.capabilities || [];
        this.description = config.description || 'Generic Service';
        this.manifest = config.manifest || {};
        this.orchestratorUrl = config.orchestratorUrl || 'ws://localhost:3002';
        this.autoReconnect = config.autoReconnect !== false;
        this.reconnectInterval = config.reconnectInterval || 5000;
        this.connected = false;
        this.connecting = false;
        this.pendingResponses = new Map();
        this.taskHandlers = new Map();
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
            const { resolve, reject, timeout } = this.pendingResponses.get(message.requestId);
            clearTimeout(timeout);
            this.pendingResponses.delete(message.requestId);
            if (message.type === 'error' || (message.content && message.content.error)) {
                reject(new Error(message.content ? message.content.error : 'Unknown error'));
            }
            else {
                resolve(message);
            }
            return;
        }
        // Handle service task specially
        if (message.type === 'service.task.execute') {
            this.handleServiceTask(message);
            return;
        }
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
                this.send({ type: 'pong', id: message.id, content: {} });
                break;
            case 'error':
                this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
                break;
        }
    }
    /**
     * Register a task handler (new API style)
     * @param {string} taskName Name of the task to handle
     * @param {Function} handler Function to call
     */
    onTask(taskName, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.taskHandlers.set(taskName, handler);
        return this; // For chaining
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
     * Handle a service task
     * @param {ServiceTaskExecuteMessage} message - The task message to handle
     */
    async handleServiceTask(message) {
        const taskId = message.id;
        const content = message.content;
        const functionName = content.functionName;
        // Create a notification function for the task
        const notifyProgress = (message, data = {}, type = 'progress') => {
            this.sendTaskNotification(taskId, message, type, data);
        };
        try {
            // Check if there's a handler for this function
            const handler = this.taskHandlers.get(functionName);
            if (!handler) {
                const errorMessage = `No handler registered for function: ${functionName}`;
                this.sendTaskNotification(taskId, errorMessage, 'error');
                this.sendTaskResult(taskId, { error: errorMessage });
                return;
            }
            // Send an initial progress notification
            notifyProgress(`Starting execution of ${functionName}`, {}, 'info');
            // Add the notification function to the parameters so the handler can use it
            const params = {
                ...content.params,
                notifyProgress
            };
            // Pass along metadata for context
            const metadata = content.metadata || {};
            // Execute the handler
            const result = await handler(params, message);
            // Send the result back
            this.sendTaskResult(taskId, result);
            // Send a completion notification
            notifyProgress(`Completed execution of ${functionName}`, {
                result: typeof result === 'object' ? { success: true } : { success: true, result }
            }, 'info');
        }
        catch (error) {
            // Handle errors
            const err = error;
            this.logger.error(`Error executing service task ${functionName}:`, err);
            // Send error notification
            this.sendTaskNotification(taskId, `Error executing ${functionName}: ${err.message}`, 'error', {
                error: err.message,
                stack: err.stack
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
     * @param {string} taskId ID of the task
     * @param {any} result Result data
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
            type: 'service.task.result',
            taskId,
            content: resultObj
        });
    }
    /**
     * Send a task notification
     * @param {string} taskId ID of the task
     * @param {string} message Notification message
     * @param {ServiceNotificationType} notificationType Type of notification
     * @param {any} data Additional data
     */
    async sendTaskNotification(taskId, message, notificationType = 'info', data = {}) {
        const notification = {
            id: (0, uuid_1.v4)(),
            type: 'service.task.notification',
            content: {
                taskId,
                notificationType,
                message,
                data,
                level: notificationType,
                timestamp: new Date().toISOString()
            }
        };
        try {
            await this.send(notification);
        }
        catch (error) {
            this.logger.error('Error sending task notification:', error);
        }
    }
    /**
     * Send a notification (legacy API)
     * @param {any} notification Notification data
     * @deprecated Use sendTaskNotification instead
     */
    async notify(notification) {
        if (!notification.taskId) {
            throw new Error('taskId is required for notifications');
        }
        const taskId = notification.taskId;
        const message = notification.message || 'Service notification';
        const type = notification.type || 'info';
        // Remove taskId, message, and type so they don't get duplicated
        const data = { ...notification };
        delete data.taskId;
        delete data.message;
        delete data.type;
        return this.sendTaskNotification(taskId, message, type, data);
    }
    /**
     * Send a notification (alias of notify for backward compatibility)
     * @param {any} notification Notification data
     * @deprecated Use sendTaskNotification instead
     */
    async sendNotification(notification) {
        return this.notify(notification);
    }
    /**
     * Send a message to the orchestrator
     * @param {BaseMessage} message Message to send
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
                if (!['service.register'].includes(message.type)) {
                    resolve(message);
                }
            });
        });
    }
    /**
     * Send a message and wait for a response
     * @param {BaseMessage} message Message to send
     * @param {number} timeout Timeout in milliseconds
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
            const timeoutId = setTimeout(() => {
                if (this.pendingResponses.has(message.id)) {
                    this.pendingResponses.delete(message.id);
                    reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
                }
            }, timeout);
            // Store the promise handlers
            this.pendingResponses.set(message.id, {
                resolve,
                reject,
                timeout: timeoutId
            });
            // Send the message
            this.ws.send(messageString, (error) => {
                if (error) {
                    clearTimeout(timeoutId);
                    this.pendingResponses.delete(message.id);
                    reject(error);
                }
            });
        });
    }
    /**
     * Set service status
     * @param {ServiceStatus} status New status
     * @param {string} message Optional status message
     */
    async setStatus(status, message = '') {
        const statusMessage = {
            id: (0, uuid_1.v4)(),
            type: 'service.status.update',
            content: {
                status,
                message
            }
        };
        await this.send(statusMessage);
    }
}
exports.SwarmServiceSDK = SwarmServiceSDK;
exports.default = SwarmServiceSDK;
