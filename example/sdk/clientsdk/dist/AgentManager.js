"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const events_1 = require("events");
/**
 * AgentManager - Handles agent-related operations
 */
class AgentManager extends events_1.EventEmitter {
    /**
     * Create a new AgentManager instance
     * @param sendRequest - Function to send requests
     */
    constructor(sendRequest) {
        super();
        this.sendRequest = sendRequest;
    }
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    async getAgents(filters = {}) {
        const response = await this.sendRequest({
            type: 'agent.list',
            content: { filters }
        });
        return response.content.agents;
    }
    /**
     * Register event listeners for agent events
     * @param emitter - Event emitter to listen to
     */
    registerEventListeners(emitter) {
        emitter.on('agent-list', (agents) => {
            this.emit('agent-list', agents);
        });
    }
}
exports.AgentManager = AgentManager;
