import { EventEmitter } from 'events';
import { Agent as AgentType } from '@agentswarmprotocol/types/common';
/**
 * Agent interface for agent data returned from the orchestrator
 */
export interface Agent {
    /** Unique agent ID */
    id: string;
    /** Agent name */
    name: string;
    /** Agent capabilities/functions */
    capabilities: string[];
    /** Current agent status */
    status: string;
    /** Optional agent description */
    description?: string;
}
/**
 * Agent filter options
 */
export interface AgentFilters {
    /** Filter by agent status */
    status?: string;
    /** Filter by agent capabilities */
    capabilities?: string[];
    /** Filter by agent name (partial match) */
    name?: string;
}
/**
 * AgentManager - Handles agent-related operations
 */
export declare class AgentManager extends EventEmitter {
    private sendRequest;
    /**
     * Create a new AgentManager instance
     * @param sendRequest - Function to send requests
     */
    constructor(sendRequest: (message: any) => Promise<any>);
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    getAgents(filters?: AgentFilters): Promise<AgentType[]>;
    /**
     * Register event listeners for agent events
     * @param emitter - Event emitter to listen to
     */
    registerEventListeners(emitter: EventEmitter): void;
}
