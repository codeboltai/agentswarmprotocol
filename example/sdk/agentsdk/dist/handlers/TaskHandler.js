"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskHandler = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
class TaskHandler extends events_1.EventEmitter {
    constructor(webSocketManager, agentId, logger = console) {
        super();
        this.webSocketManager = webSocketManager;
        this.agentId = agentId;
        this.logger = logger;
        this.taskHandlers = new Map();
        this.defaultTaskHandler = null;
    }
    /**
     * Register a task handler for a specific task type
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    registerTaskHandler(taskType, handler) {
        this.taskHandlers.set(taskType, handler);
        return this;
    }
    /**
     * Register a default task handler for when no specific handler is found
     * @param handler Handler function
     */
    registerDefaultTaskHandler(handler) {
        this.defaultTaskHandler = handler;
        return this;
    }
    /**
     * Handle an incoming task
     * @param message Task execution message
     */
    async handleTask(message) {
        const taskId = message.content?.taskId;
        const taskType = message.content?.type;
        const taskData = message.content?.data;
        if (!taskId) {
            this.logger.error('Task execution message missing taskId');
            return;
        }
        // Emit task event
        this.emit('task', taskData, message);
        if (taskType) {
            this.emit(`task.${taskType}`, taskData, message);
        }
        try {
            // Find the appropriate handler
            let handler = this.defaultTaskHandler;
            if (taskType && this.taskHandlers.has(taskType)) {
                handler = this.taskHandlers.get(taskType);
            }
            if (!handler) {
                throw new Error(`No handler registered for task type: ${taskType}`);
            }
            // Update task status
            this.sendTaskStatus(taskId, 'started');
            // Execute the handler
            const result = await handler(taskData, message);
            // Send the result
            this.sendTaskResult(taskId, result);
            // Update task status
            this.sendTaskStatus(taskId, 'completed');
        }
        catch (err) {
            const error = err;
            this.logger.error(`Error executing task: ${error.message}`);
            // Update task status
            this.sendTaskStatus(taskId, 'failed', { error: error.message });
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
            type: 'task.result',
            content: {
                agentId: this.agentId,
                taskId,
                result
            }
        });
    }
    /**
     * Send a task status update
     * @param taskId ID of the task
     * @param status Status to set
     * @param metadata Optional metadata
     */
    sendTaskStatus(taskId, status, metadata = {}) {
        this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'task.status',
            content: {
                agentId: this.agentId,
                taskId,
                status,
                ...metadata
            }
        });
    }
    /**
     * Send a message during task execution
     * @param taskId ID of the task
     * @param content Message content
     */
    sendMessage(taskId, content) {
        this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'task.message',
            content: {
                agentId: this.agentId,
                taskId,
                message: content
            }
        });
    }
    /**
     * Send a task notification
     * @param notification Notification data
     */
    async sendTaskNotification(notification) {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'task.notification',
            content: {
                agentId: this.agentId,
                notification
            }
        });
    }
}
exports.TaskHandler = TaskHandler;
