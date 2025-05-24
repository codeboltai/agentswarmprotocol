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
        // Remove taskHandlers map since we'll only have one handler
        // private taskHandlers: Map<string, TaskHandlerType> = new Map();
        this.taskHandler = null;
    }
    /**
     * Set the task handler for all incoming tasks
     * @param handler Handler function
     */
    onTask(handler) {
        this.taskHandler = handler;
        return this;
    }
    /**
     * Handle an incoming task
     * @param message Task execution message
     */
    async handleTask(message) {
        const taskId = message.content?.taskId;
        const taskData = message.content?.data;
        if (!taskId) {
            this.logger.error('Task execution message missing taskId');
            return;
        }
        // Add detailed logging about the message and task data
        this.logger.info(`Processing task ${taskId}`);
        this.logger.info(`Task message structure: ${JSON.stringify({
            hasContent: !!message.content,
            contentKeys: message.content ? Object.keys(message.content) : [],
            taskDataType: taskData ? typeof taskData : 'undefined',
            taskDataIsEmpty: taskData ? (typeof taskData === 'object' ? Object.keys(taskData).length === 0 : false) : true,
            taskDataKeys: taskData && typeof taskData === 'object' ? Object.keys(taskData) : []
        })}`);
        // Emit task event
        this.emit('task', taskData, message);
        try {
            // Check if we have a handler
            if (!this.taskHandler) {
                throw new Error('No task handler registered');
            }
            // Update task status
            this.sendTaskStatus(taskId, 'started');
            // Execute the handler
            const result = await this.taskHandler(taskData, message);
            // Send the result
            this.sendTaskResult(taskId, result);
            // Update task status with the result to ensure completion is recognized
            this.sendTaskStatus(taskId, 'completed', { result });
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
            type: 'agent.task.result',
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
    sendTaskMessage(taskId, content) {
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
     * Send a request message during task execution and wait for a response
     * @param taskId ID of the task being executed
     * @param content Request content
     * @param timeout Timeout in milliseconds
     * @returns Promise that resolves with the response
     */
    requestMessageDuringTask(taskId, content, timeout = 30000) {
        const requestId = (0, uuid_1.v4)();
        return this.webSocketManager.sendAndWaitForResponse({
            id: requestId,
            type: 'task.requestmessage',
            content: {
                agentId: this.agentId,
                taskId,
                request: content
            }
        }, timeout)
            .then(response => {
            if (response.content && response.content.result) {
                return response.content.result;
            }
            return response.content;
        });
    }
}
exports.TaskHandler = TaskHandler;
