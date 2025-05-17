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
     * @param sdk - SwarmClientSDK instance for event listening
     */
    constructor(wsClient, sdk) {
        this.wsClient = wsClient;
        this.sdk = sdk;
    }
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    async sendTask(agentName, taskData, options = {}) {
        const waitForResult = options.waitForResult !== false;
        const timeout = options.timeout || 60000; // Default 60 second timeout
        console.log(`Sending task to agent ${agentName}`);
        // Create task
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'task.create',
            content: {
                agentName,
                taskData
            }
        });
        return response.content;
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