import { EventEmitter } from 'events';
import { AgentStatus, Agent as AgentType } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from './WebSocketClient';

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
export class AgentManager extends EventEmitter {
  private wsClient: WebSocketClient;

  /**
   * Create a new AgentManager instance
   * @param wsClient - WebSocketClient instance
   */
  constructor(wsClient: WebSocketClient) {
    super();
    this.wsClient = wsClient;
  }

  /**
   * Get a list of all registered agents
   * @param filters - Optional filters to apply to the agent list
   * @returns Array of agent objects
   */
  async getAgentsList(filters: AgentFilters = {}): Promise<AgentType[]> {
    const response = await this.wsClient.sendRequest({
      type: 'agent.list',
      content: { filters }
    });
    
    return response.content.agents;
  }

  /**
   * Register event listeners for agent events
   */
  registerEventListeners(): void {
    this.wsClient.on('agent-list', (agents: AgentType[]) => {
      this.emit('agent-list', agents);
    });
  }
} 