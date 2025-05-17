import { Agent as AgentType } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from '../service/WebSocketClient';
import { AgentFilters } from '../types';
/**
 * AgentManager - Handles agent-related operations
 */
export declare class AgentManager {
    private wsClient;
    /**
     * Create a new AgentManager instance
     * @param wsClient - WebSocketClient instance
     */
    constructor(wsClient: WebSocketClient);
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    getAgentsList(filters?: AgentFilters): Promise<AgentType[]>;
}
