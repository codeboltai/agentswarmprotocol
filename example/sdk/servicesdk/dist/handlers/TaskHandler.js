"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskHandler = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
class TaskHandler extends events_1.EventEmitter {
    constructor(webSocketManager, serviceId, logger = console) {
        super();
        this.webSocketManager = webSocketManager;
        this.serviceId = serviceId;
        this.logger = logger;
        this.taskHandlers = new Map();
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
     * Handle a service task
     * @param {ServiceTaskExecuteMessage} message - The task message to handle
     */
    async handleServiceTask(message) {
        const taskId = message.id;
        const content = message.content;
        const functionName = content.functionName;
        const params = content.params || {};
        const clientId = content.clientId;
        // Set up a notification helper for this task
        const notifyProgress = (message, data = {}, type = 'progress') => {
            this.sendTaskNotification(taskId, message, type, data);
            // Also emit locally
            this.emit('notification', {
                taskId,
                message,
                type,
                data
            });
        };
        // Add notification helper to params if it's already an object
        if (typeof params === 'object' && params !== null) {
            params.notify = notifyProgress;
            if (clientId) {
                params.clientId = clientId;
            }
        }
        try {
            // Find handler for this function
            const handler = this.taskHandlers.get(functionName);
            if (!handler) {
                throw new Error(`No handler registered for function: ${functionName}`);
            }
            // Update task status
            notifyProgress(`Starting task: ${functionName}`, {}, 'started');
            // Execute the handler
            const result = await handler(params, message);
            // Send the result
            this.sendTaskResult(taskId, result);
            // Update task status
            notifyProgress(`Task completed: ${functionName}`, {}, 'completed');
        }
        catch (err) {
            // Handle errors
            const error = err;
            this.logger.error(`Error handling task ${functionName}:`, error);
            // Update task status
            notifyProgress(`Task failed: ${error.message}`, { error: error.message }, 'failed');
            // Send error result
            this.sendTaskResult(taskId, { error: error.message });
        }
    }
    /**
     * Send a task result back to the orchestrator
     * @param taskId ID of the task
     * @param result Result data
     */
    sendTaskResult(taskId, result) {
        this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.task.result',
            content: {
                serviceId: this.serviceId,
                taskId,
                result
            }
        });
    }
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
}
exports.TaskHandler = TaskHandler;
