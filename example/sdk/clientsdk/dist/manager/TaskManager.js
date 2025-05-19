"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskManager = void 0;
/**
 * TaskManager - Handles task-related operations
 */
class TaskManager {
    /**
     * Create a new TaskManager instance
     * @param wsClient - WebSocketClient instance
     */
    constructor(wsClient) {
        this.wsClient = wsClient;
    }
    /**
     * Send a task to an agent
     * @param agentId - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    async sendTask(agentId, agentName, taskData, options = {}) {
        console.log(`Sending task to agent ${agentId}`);
        // Create task
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'task.create',
            content: {
                event: 'task.completed',
                agentId,
                agentName,
                taskData
            }
        });
        return response.content;
    }
    /**
     * Send a message to a running task
     * @param taskId - ID of the task to send the message to
     * @param message - Message to send (can be string or structured data)
     * @param options - Additional options like message type
     * @returns Response from the message delivery
     */
    async sendMessageDuringTask(taskId, message, options = {}) {
        console.log(`Sending message to task ${taskId}`);
        const messageType = options.messageType || 'client.message';
        const timeout = options.timeout || 30000;
        // Prepare message content
        const messageContent = typeof message === 'string'
            ? { text: message }
            : message;
        // Send the message to the task without waiting for a response
        const response = await this.wsClient.send({
            type: 'task.message',
            content: {
                taskId,
                messageType,
                message: messageContent
            }
        });
    }
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status
     */
    async getTaskStatus(taskId) {
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'task.status',
            content: {
                taskId
            }
        });
        return response.content;
    }
}
exports.TaskManager = TaskManager;
//# sourceMappingURL=TaskManager.js.map