/**
 * Agent Registry for the ASP Orchestrator
 * Responsible for managing agent registrations, capabilities, and connections
 */

import { Agent as BaseAgent, AgentStatus, AgentRegistry as IAgentRegistry } from "../../../types/common";

// Extended Agent interface for backward compatibility
interface Agent extends BaseAgent {
  statusDetails?: any;
  connection?: any; // WebSocket connection object
}

interface AgentConfiguration {
  id: string;
  name: string;
  capabilities: string[];
  metadata: Record<string, any>;
  configuredAt: string;
}

// Track connections that haven't been associated with agents yet
interface PendingConnection {
  connectionId: string;
  connection: any; // WebSocket connection
  connectedAt: string;
}

export class AgentRegistry implements IAgentRegistry {
  private agents: Map<string, Agent>;
  private agentsByName: Map<string, Agent>;
  private agentsByConnectionId: Map<string, Agent>;
  private agentConfigurations: Map<string, AgentConfiguration>;
  private connections: Map<string, any>; // Map of connectionId to WebSocket
  private pendingConnections: Map<string, PendingConnection>; // Connections waiting for agent.register

  constructor() {
    this.agents = new Map(); // Maps agent IDs to agent objects
    this.agentsByName = new Map(); // Maps agent names to agent objects
    this.agentsByConnectionId = new Map(); // Maps connection IDs to agent objects
    this.agentConfigurations = new Map(); // Maps agent IDs to preconfigured settings
    this.connections = new Map(); // Maps connection IDs to WebSocket objects
    this.pendingConnections = new Map(); // Connections waiting for agent.register
  }

  /**
   * Add a new connection to pending connections
   * @param connectionId - The connection ID
   * @param connection - The WebSocket connection object
   * @returns The pending connection object
   */
  addPendingConnection(connectionId: string, connection: any): PendingConnection {
    const pendingConnection: PendingConnection = {
      connectionId,
      connection,
      connectedAt: new Date().toISOString()
    };
    
    this.pendingConnections.set(connectionId, pendingConnection);
    this.connections.set(connectionId, connection); // Also store in connections map
    
    return pendingConnection;
  }

  /**
   * Get a pending connection by connection ID
   * @param connectionId - The connection ID
   * @returns The pending connection object or undefined if not found
   */
  getPendingConnection(connectionId: string): PendingConnection | undefined {
    return this.pendingConnections.get(connectionId);
  }

  /**
   * Register a new agent or update an existing one
   * @param {Agent} agent - The agent object to register
   * @returns {Agent} The registered agent
   */
  registerAgent(agent: Agent): Agent {
    if (!agent.id) {
      throw new Error('Agent ID is required');
    }
    
    if (!agent.name) {
      throw new Error('Agent name is required');
    }
    
    // Check if an agent with the same name already exists
    const existingAgentWithSameName = this.agentsByName.get(agent.name);
    if (existingAgentWithSameName && existingAgentWithSameName.id !== agent.id) {
      // If an agent with the same name exists but with a different ID, update its status to offline
      existingAgentWithSameName.status = 'offline';
      this.agents.set(existingAgentWithSameName.id, existingAgentWithSameName);
    }
    
    // If the agent has a connectionId, try to get the connection object
    if (agent.connectionId && !agent.connection) {
      const connection = this.connections.get(agent.connectionId);
      if (connection) {
        agent.connection = connection;
      }
      
      // Remove from pending connections if it was there
      this.pendingConnections.delete(agent.connectionId);
    }
    
    // Store the agent
    this.agents.set(agent.id, agent);
    this.agentsByName.set(agent.name, agent);
    
    if (agent.connectionId) {
      this.agentsByConnectionId.set(agent.connectionId, agent);
    }
    
    return agent;
  }

  /**
   * Set a WebSocket connection for a specific connection ID
   * @param connectionId - The connection ID
   * @param connection - The WebSocket connection object
   * @returns true if set successfully
   */
  setConnection(connectionId: string, connection: any): boolean {
    if (!connectionId) {
      return false;
    }
    
    // Store the connection
    this.connections.set(connectionId, connection);
    
    // Add to pending connections as well
    this.addPendingConnection(connectionId, connection);
    
    return true;
  }

  /**
   * Get a WebSocket connection by connection ID
   * @param connectionId - The connection ID
   * @returns The WebSocket connection object or undefined if not found
   */
  getConnection(connectionId: string): any {
    return this.connections.get(connectionId);
  }
  
  /**
   * Get a WebSocket connection for an agent by agent ID
   * @param agentId - The agent ID
   * @returns The WebSocket connection object or undefined if not found
   */
  getConnectionByAgentId(agentId: string): any {
    const agent = this.getAgentById(agentId);
    if (!agent || !agent.connectionId) {
      return undefined;
    }
    
    return this.getConnection(agent.connectionId);
  }

  /**
   * Associate an agent with a WebSocket connection
   * @param agentId - The agent ID
   * @param connectionId - The connection ID
   * @param connection - The WebSocket connection object
   * @returns true if successful
   */
  associateAgentWithConnection(agentId: string, connectionId: string, connection: any): boolean {
    const agent = this.getAgentById(agentId);
    if (!agent) {
      return false;
    }
    
    // Update the agent's connectionId
    agent.connectionId = connectionId;
    agent.connection = connection; // For backward compatibility
    
    // Store the updated agent
    this.agents.set(agentId, agent);
    this.agentsByConnectionId.set(connectionId, agent);
    
    // Store the connection
    this.connections.set(connectionId, connection);
    
    // Remove from pending connections if it was there
    this.pendingConnections.delete(connectionId);
    
    return true;
  }

  /**
   * Remove a connection by connection ID
   * @param connectionId - The connection ID to remove
   * @returns true if successfully removed
   */
  removeConnection(connectionId: string): boolean {
    const wasRemoved = this.connections.delete(connectionId);
    
    // Also update any agent that was using this connection
    const agent = this.getAgentByConnectionId(connectionId);
    if (agent) {
      // Create a new agent object without the connection properties
      const { connectionId: _, connection: __, ...agentWithoutConnection } = agent;
      const updatedAgent = {
        ...agentWithoutConnection,
        status: 'offline' as AgentStatus
      };
      
      this.agents.set(agent.id, updatedAgent as Agent);
      this.agentsByConnectionId.delete(connectionId);
    }
    
    // Remove from pending connections if it was there
    this.pendingConnections.delete(connectionId);
    
    return wasRemoved;
  }

  /**
   * Get an agent by ID
   * @param {string} agentId - The ID of the agent to get
   * @returns {Agent|undefined} The agent object or undefined if not found
   */
  getAgentById(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get an agent by name
   * @param {string} agentName - The name of the agent to get
   * @returns {Agent|undefined} The agent object or undefined if not found
   */
  getAgentByName(agentName: string): Agent | undefined {
    return this.agentsByName.get(agentName);
  }

  /**
   * Get an agent by connection ID
   * @param {string} connectionId - The connection ID to look up
   * @returns {Agent|undefined} The agent object or undefined if not found
   */
  getAgentByConnectionId(connectionId: string): Agent | undefined {
    return this.agentsByConnectionId.get(connectionId);
  }

  /**
   * Get agent WebSocket connection by connection ID
   * @param connectionId - The connection ID of the agent
   * @returns The WebSocket connection object or undefined if not found
   */
  getAgentConnection(connectionId: string): any {
    // For backward compatibility, first try the old way
    const agent = this.getAgentByConnectionId(connectionId);
    if (agent?.connection) {
      return agent.connection;
    }
    
    // Then try the new way
    return this.getConnection(connectionId);
  }

  /**
   * Get all registered agents
   * @param {Object} options - Filter options
   * @returns {Array<Agent>} List of matching agents
   */
  getAllAgents(options: { status?: AgentStatus; capabilities?: string[] } = {}): Agent[] {
    let agents = Array.from(this.agents.values());
    
    // Filter by status if provided
    if (options.status) {
      agents = agents.filter(agent => agent.status === options.status);
    }
    
    // Filter by capabilities if provided
    if (options.capabilities && options.capabilities.length > 0) {
      agents = agents.filter(agent => {
        return options.capabilities!.every(cap => 
          agent.capabilities && agent.capabilities.includes(cap)
        );
      });
    }
    
    return agents;
  }

  /**
   * Update an agent's status
   * @param {string} agentId - The ID of the agent to update
   * @param {AgentStatus} status - The new status
   * @param {any} details - Optional status details
   * @returns {Agent|null} The updated agent or null if not found
   */
  updateAgentStatus(agentId: string, status: AgentStatus, details?: any): Agent | null {
    const agent = this.getAgentById(agentId);
    if (!agent) {
      return null;
    }
    
    agent.status = status;
    
    // Add details if provided
    if (details) {
      agent.statusDetails = details;
    }
    
    this.agents.set(agentId, agent);
    
    return agent;
  }

  /**
   * Remove an agent by ID
   * @param {string} agentId - The ID of the agent to remove
   * @returns {boolean} True if the agent was removed, false otherwise
   */
  removeAgent(agentId: string): boolean {
    const agent = this.getAgentById(agentId);
    if (!agent) {
      return false;
    }
    
    this.agents.delete(agentId);
    
    if (agent.name) {
      this.agentsByName.delete(agent.name);
    }
    
    if (agent.connectionId) {
      this.agentsByConnectionId.delete(agent.connectionId);
      // We don't remove the WebSocket connection here in case it's needed for cleanup
    }
    
    return true;
  }

  /**
   * Remove an agent by connection ID
   * @param {string} connectionId - The connection ID of the agent to remove
   * @returns {boolean} True if the agent was removed, false otherwise
   */
  removeAgentByConnectionId(connectionId: string): boolean {
    const agent = this.getAgentByConnectionId(connectionId);
    if (!agent) {
      return false;
    }
    
    return this.removeAgent(agent.id);
  }

  /**
   * Find agents that have specific capabilities
   * @param {string[]} capabilities - List of required capabilities
   * @param {Object} options - Additional filter options
   * @returns {Agent[]} List of matching agents
   */
  findAgentsByCapabilities(
    capabilities: string[], 
    options: { status?: AgentStatus } = {}
  ): Agent[] {
    return this.getAllAgents({
      ...options,
      capabilities
    });
  }

  /**
   * Get the number of registered agents
   * @param {Object} options - Filter options
   * @returns {number} The number of agents
   */
  getAgentCount(options: { status?: AgentStatus } = {}): number {
    return this.getAllAgents(options).length;
  }

  /**
   * Add a configuration for an agent
   * @param {string} agentName - The name to associate with this configuration
   * @param {object} configuration - The agent configuration
   */
  addAgentConfiguration(agentName: string, configuration: any): void {
    if (!agentName) {
      throw new Error('Agent name is required for configuration');
    }
    
    const agentConfig: AgentConfiguration = {
      id: configuration.id || `config-${Date.now()}`,
      name: agentName,
      capabilities: configuration.capabilities || [],
      metadata: configuration.metadata || {},
      configuredAt: new Date().toISOString()
    };
    
    // Store by name for easier lookup
    this.agentConfigurations.set(agentName, agentConfig);
  }

  /**
   * Set configuration for an agent that will connect later
   * @param {string} agentId - The ID to associate with this configuration
   * @param {Object} configuration - The agent configuration
   * @returns {AgentConfiguration} The stored configuration
   */
  setAgentConfiguration(agentId: string, configuration: {
    name: string;
    capabilities?: string[];
    metadata?: Record<string, any>;
  }): AgentConfiguration {
    if (!agentId) {
      throw new Error('Agent ID is required for configuration');
    }
    
    if (!configuration.name) {
      throw new Error('Agent name is required for configuration');
    }
    
    const agentConfig: AgentConfiguration = {
      id: agentId,
      name: configuration.name,
      capabilities: configuration.capabilities || [],
      metadata: configuration.metadata || {},
      configuredAt: new Date().toISOString()
    };
    
    // Store the configuration
    this.agentConfigurations.set(agentId, agentConfig);
    
    return agentConfig;
  }
  
  /**
   * Get an agent configuration by ID
   * @param {string} agentId - The ID of the configuration to get
   * @returns {AgentConfiguration|null} The agent configuration or null if not found
   */
  getAgentConfiguration(agentId: string): AgentConfiguration | null {
    return this.agentConfigurations.get(agentId) || null;
  }
  
  /**
   * Get an agent configuration by name
   * @param {string} name - The name of the configuration to get
   * @returns {any|null} The agent configuration or null if not found
   */
  getAgentConfigurationByName(name: string): any | null {
    // Try to find a configuration with this name
    for (const config of this.agentConfigurations.values()) {
      if (config.name === name) {
        return config;
      }
    }
    return null;
  }
} 