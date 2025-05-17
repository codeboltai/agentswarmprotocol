"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
/**
 * AgentManager - Handles agent-related operations
 */
class AgentManager {
    /**
     * Create a new AgentManager instance
     * @param wsClient - WebSocketClient instance
     */
    constructor(wsClient) {
        this.wsClient = wsClient;
    }
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    async getAgentsList(filters = {}) {
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'agent.list',
            content: { filters }
        });
        return response.content.agents;
    }
}
exports.AgentManager = AgentManager;
//# sourceMappingURL=AgentManager.js.map