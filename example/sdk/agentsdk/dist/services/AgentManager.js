"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const uuid_1 = require("uuid");
class AgentManager {
    constructor(webSocketManager, agentId, logger = console) {
        this.webSocketManager = webSocketManager;
        this.agentId = agentId;
        this.logger = logger;
    }
    /**
     * Get list of agents
     * @param filters Filter criteria
     */
    async getAgentList(filters = {}) {
        const response = await this.webSocketManager.sendRequestWaitForResponse({
            type: 'agent.agent.list.request',
            content: { filters }
        }, {
            customEvent: 'agent.agent.list.response'
        });
        return response.content.agents;
    }
    /**
     * Set agent status
     * @param status New status
     */
    async setStatus(status) {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'agent.status',
            content: {
                status
            }
        });
    }
    /**
     * Request a task from another agent
     * @param targetAgentName Name of the target agent
     * @param taskData Task data
     * @param timeout Request timeout
     */
    async executeChildAgentTask(targetAgentName, taskData, timeout = 30000) {
        // Use sendRequestWaitForResponse with custom event to wait for childagent.response
        const response = await this.webSocketManager.sendRequestWaitForResponse({
            id: (0, uuid_1.v4)(),
            type: 'agent.request',
            content: {
                targetAgent: targetAgentName,
                taskData
            }
        }, {
            timeout,
            customEvent: 'childagent.response',
            anyMessageId: true
        });
        if (response.content.error) {
            throw new Error(response.content.error);
        }
        // The response structure is: response.content.result.result
        // where the first .result is the orchestrator wrapper and the second .result is the actual task result
        return response.content.result?.result || response.content.result;
    }
    /**
     * Register a handler for agent requests
     * @param taskType Type of task to handle
     * @param handler Handler function
     */
    onAgentRequest(taskType, handler) {
        // This would register a task handler with the passed taskType
        // Implementation depends on how TaskHandler class is used
        this.emit('register-task-handler', taskType, handler);
        return this;
    }
    // Event emitter for internal communication
    emit(event, ...args) {
        // This is a simplified version - in a real implementation, you'd use EventEmitter
        this.logger.debug(`AgentManager emitting ${event}`);
    }
}
exports.AgentManager = AgentManager;
