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
        const taskId = response.content.taskId;
        if (!waitForResult) {
            return response.content;
        }
        // Wait for task result using the central event handling in SDK
        return new Promise((resolve, reject) => {
            let isResolved = false;
            // Define handlers
            const resultHandler = (result) => {
                if (result.taskId === taskId && !isResolved) {
                    isResolved = true;
                    cleanup();
                    resolve(result);
                }
            };
            const statusHandler = (status) => {
                var _a;
                if (status.taskId === taskId && status.status === 'failed' && !isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(new Error(`Task failed: ${((_a = status.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}`));
                }
            };
            const timeoutCallback = () => {
                if (!isResolved) {
                    isResolved = true;
                    reject(new Error(`Task timeout after ${timeout}ms: ${taskId}`));
                }
            };
            // Register handlers with the SDK
            const cleanup = this.sdk.registerTaskListeners(taskId, {
                resultHandler,
                statusHandler,
                timeout,
                timeoutCallback
            });
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