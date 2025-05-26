/**
 * Agent Registry for the ASP Orchestrator
 * Responsible for managing agent registrations, capabilities, and connections
 */

import { Agent, AgentStatus, AgentRegistry as IAgentRegistry } from "../../../types/common";



interface ConnectedAgent {
  agent: Agent;
  connection: any;
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
  private connectedAgents: Map<string, ConnectedAgent>; // Map of connectionId to ConnectedAgent
  private pendingConnections: Map<string, PendingConnection>; // Connections waiting for agent.register
  private agentConfigurations: Map<string, AgentConfiguration>; // Maps agent IDs to preconfigured settings

  constructor() {
    this.connectedAgents = new Map(); // Maps connection IDs to Agent objects (with status indicating connected/disconnected)
    this.pendingConnections = new Map(); // Connections waiting for agent.register
    this.agentConfigurations = new Map(); // Maps agent IDs to preconfigured settings
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
   * Find an agent by name
   * @param name - Name of the agent to find
   * @returns The agent or undefined if not found
   */
  private findAgentByName(name: string): Agent | undefined {
    // Search for agents by name in connected agents
    for (const connectedAgent of this.connectedAgents.values()) {
      if (connectedAgent.agent.name === name) {
        return connectedAgent.agent;
      }
    }
    
    return undefined;
  }

  /**
   * Register a new agent or update an existing one
   * @param {Agent} agent - The agent object to register
   * @param {string} connectionId - The connection ID for the agent
   * @returns {Agent} The registered agent
   */
  registerAgent(agent: Agent, connectionId?: string): Agent {
    if (!agent.id) {
      throw new Error('Agent ID is required');
    }
    
    if (!agent.name) {
      throw new Error('Agent name is required');
    }
    
    // Check if an agent with the same ID already exists (reconnection scenario)
    let existingAgentEntry: ConnectedAgent | undefined;
    let existingConnectionId: string | undefined;
    
    for (const [connId, connectedAgent] of this.connectedAgents.entries()) {
      if (connectedAgent.agent.id === agent.id) {
        existingAgentEntry = connectedAgent;
        existingConnectionId = connId;
        break;
      }
    }
    
    // If connectionId is provided, use it to create/update a connected agent
    if (connectionId) {
      // Get the connection from pending connections
      const pendingConnection = this.pendingConnections.get(connectionId);
      if (pendingConnection) {
        // If the agent already exists, this is a reconnection
        if (existingAgentEntry && existingConnectionId) {
          console.log(`Agent ${agent.name} (${agent.id}) reconnecting with new connection ${connectionId}`);
          
          // Remove the old connection entry
          this.connectedAgents.delete(existingConnectionId);
          
          // Update the existing agent with new connection info
          const reconnectedAgent: ConnectedAgent = {
            agent: {
              ...existingAgentEntry.agent,
              ...agent, // Merge any updated agent properties
              status: 'online',
              connectionId,
              statusDetails: {
                reconnectedAt: new Date().toISOString(),
                previousConnectionId: existingConnectionId
              }
            },
            connection: pendingConnection.connection
          };
          
          this.connectedAgents.set(connectionId, reconnectedAgent);
        } else {
          // This is a new agent registration
          console.log(`New agent ${agent.name} (${agent.id}) registering with connection ${connectionId}`);
          
          // Check if an agent with the same name already exists but with a different ID
          const existingAgentWithSameName = this.findAgentByName(agent.name);
          if (existingAgentWithSameName && existingAgentWithSameName.id !== agent.id) {
            // Mark the old agent as offline
            this.updateAgentStatus(existingAgentWithSameName.id, 'offline', {
              disconnectedAt: new Date().toISOString(),
              disconnectedReason: 'Replaced by agent with same name but different ID'
            });
          }
          
          // Create a new connected agent entry
          const connectedAgent: ConnectedAgent = {
            agent: {
              ...agent,
              status: 'online',
              connectionId
            },
            connection: pendingConnection.connection
          };
          
          this.connectedAgents.set(connectionId, connectedAgent);
        }
        
        // Remove from pending connections
        this.pendingConnections.delete(connectionId);
      }
    } else {
      // No connection provided - create an offline agent entry
      if (existingAgentEntry) {
        // Update existing agent to offline
        existingAgentEntry.agent.status = 'offline';
        existingAgentEntry.agent.statusDetails = {
          disconnectedAt: new Date().toISOString()
        };
      } else {
        // Create new offline agent entry
        const offlineAgent: ConnectedAgent = {
          agent: {
            ...agent,
            status: 'offline',
            connectionId: `offline_${agent.id}`
          },
          connection: null
        };
        
        this.connectedAgents.set(offlineAgent.agent.connectionId, offlineAgent);
      }
    }
    
    return agent;
  }

  /**
   * Get a WebSocket connection by connection ID
   * @param connectionId - The connection ID
   * @returns The WebSocket connection object or undefined if not found
   */
  getConnection(connectionId: string): any {
    // First check connected agents
    const connectedAgent = this.connectedAgents.get(connectionId);
    if (connectedAgent && connectedAgent.agent.status === 'online') {
      return connectedAgent.connection;
    }
    
    // Then check pending connections
    const pendingConnection = this.pendingConnections.get(connectionId);
    if (pendingConnection) {
      return pendingConnection.connection;
    }
    
    return undefined;
  }

  /**
   * Get a connected agent by connection ID
   * @param connectionId - The connection ID
   * @returns The connected agent or undefined if not found
   */
  getConnectedAgent(connectionId: string): ConnectedAgent | undefined {
    const agent = this.connectedAgents.get(connectionId);
    if (agent && agent.agent.status === 'online') {
      return agent;
    }
    return undefined;
  }
  
  /**
   * Get a WebSocket connection for an agent by agent ID
   * @param agentId - The agent ID
   * @returns The WebSocket connection object or undefined if not found
   */
  getConnectionByAgentId(agentId: string): any {
    // Find agent in connected agents with online status
    for (const connectedAgent of this.connectedAgents.values()) {
      if (connectedAgent.agent.id === agentId && connectedAgent.agent.status === 'online') {
        return connectedAgent.connection;
      }
    }
    
    return undefined;
  }

  /**
   * Get connection ID by agent ID
   * @param agentId - The agent ID
   * @returns The connection ID or undefined if not found
   */
  getConnectionIdByAgentId(agentId: string): string | undefined {
    // Find agent in connected agents with online status
    for (const connectedAgent of this.connectedAgents.values()) {
      if (connectedAgent.agent.id === agentId && connectedAgent.agent.status === 'online') {
        return connectedAgent.agent.connectionId;
      }
    }
    
    return undefined;
  }

  /**
   * Associate an agent with a WebSocket connection
   * @param agentId - The agent ID
   * @param connectionId - The connection ID
   * @returns true if successful
   */
  associateAgentWithConnection(agentId: string, connectionId: string): boolean {
    // Find the agent by ID
    const agent = this.getAgentById(agentId);
    if (!agent) {
      return false;
    }
    
    // Get the connection from pending connections
    const pendingConnection = this.pendingConnections.get(connectionId);
    if (!pendingConnection) {
      return false;
    }
    
    // Create a connected agent entry
    const connectedAgent: ConnectedAgent = {
      agent: {
        ...agent,
        status: 'online',
        connectionId
      },
      connection: pendingConnection.connection
    };
    
    // If the agent had a previous connection, update its status
    for (const [existingConnId, existing] of this.connectedAgents.entries()) {
      if (existing.agent.id === agentId && existingConnId !== connectionId) {
        this.connectedAgents.delete(existingConnId);
      }
    }
    
    // Store the new connection
    this.connectedAgents.set(connectionId, connectedAgent);
    
    // Remove from pending connections
    this.pendingConnections.delete(connectionId);
    
    return true;
  }

  /**
   * Remove a connection by connection ID
   * @param connectionId - The connection ID to remove
   * @returns true if successfully removed
   */
  removeConnection(connectionId: string): boolean {
    // If it's a connected agent, update the status to offline but keep the agent in the registry
    const connectedAgent = this.connectedAgents.get(connectionId);
    if (connectedAgent) {
      connectedAgent.agent.status = 'offline';
      connectedAgent.agent.statusDetails = {
        disconnectedAt: new Date().toISOString(),
        lastConnectionId: connectionId
      };
      
      // Keep entry in registry with updated status
      return true;
    }
    
    // Check if it's a pending connection
    if (this.pendingConnections.has(connectionId)) {
      this.pendingConnections.delete(connectionId);
      return true;
    }
    
    return false;
  }

  /**
   * Get an agent by ID
   * @param agentId - The agent ID
   * @returns The agent or undefined if not found
   */
  getAgentById(agentId: string): Agent | undefined {
    // Check all agents in the registry (both online and offline)
    for (const connectedAgent of this.connectedAgents.values()) {
      if (connectedAgent.agent.id === agentId) {
        return connectedAgent.agent;
      }
    }
    
    return undefined;
  }

  /**
   * Get an agent by name
   * @param agentName - The agent name
   * @returns The agent or undefined if not found
   */
  getAgentByName(agentName: string): Agent | undefined {
    return this.findAgentByName(agentName);
  }

  /**
   * Get an agent by connection ID
   * @param connectionId - The connection ID
   * @returns The agent or undefined if not found
   */
  getAgentByConnectionId(connectionId: string): Agent | undefined {
    const connectedAgent = this.connectedAgents.get(connectionId);
    return connectedAgent ? connectedAgent.agent : undefined;
  }

  /**
   * Get all agents, optionally filtered by status and capabilities
   * @param options - Optional filters
   * @returns Array of agents
   */
  getAllAgents(options: { status?: AgentStatus; capabilities?: string[] } = {}): Agent[] {
    const { status, capabilities } = options;
    let result: Agent[] = [];
    
    // Add all agents (both online and offline)
    for (const connectedAgent of this.connectedAgents.values()) {
      result.push(connectedAgent.agent);
    }
    
    // Filter by status if specified
    if (status) {
      result = result.filter(agent => agent.status === status);
    }
    
    // Filter by capabilities if specified
    if (capabilities && capabilities.length > 0) {
      result = result.filter(agent => 
        capabilities.every(cap => agent.capabilities?.includes(cap))
      );
    }
    
    return result;
  }

  /**
   * Get all connected agents (with online status)
   * @returns Array of connected agent objects
   */
  getAllConnectedAgents(): ConnectedAgent[] {
    return Array.from(this.connectedAgents.values())
      .filter(agent => agent.agent.status === 'online');
  }

  /**
   * Update the status of an agent
   * @param agentId - The agent ID
   * @param status - The new status
   * @param details - Optional status details
   * @returns The updated agent or null if not found
   */
  updateAgentStatus(agentId: string, status: AgentStatus, details?: any): Agent | null {
    // Find the agent in our registry
    for (const connectedAgent of this.connectedAgents.values()) {
      if (connectedAgent.agent.id === agentId) {
        // Update agent status
        connectedAgent.agent.status = status;
        
        if (details) {
          connectedAgent.agent.statusDetails = details;
        }
        
        return connectedAgent.agent;
      }
    }
    
    return null;
  }

  /**
   * Remove an agent by ID
   * @param agentId - The agent ID to remove
   * @returns true if successfully removed
   */
  removeAgent(agentId: string): boolean {
    // Check all agent entries
    for (const [connectionId, connectedAgent] of this.connectedAgents.entries()) {
      if (connectedAgent.agent.id === agentId) {
        this.connectedAgents.delete(connectionId);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Find agents by capabilities
   * @param capabilities - Array of required capabilities
   * @param options - Optional filters
   * @returns Array of matching agents
   */
  findAgentsByCapabilities(
    capabilities: string[], 
    options: { status?: AgentStatus } = {}
  ): Agent[] {
    const agents = this.getAllAgents(options);
    return agents.filter(agent => 
      capabilities.every(cap => agent.capabilities?.includes(cap))
    );
  }

  /**
   * Get the count of agents, optionally filtered by status
   * @param options - Optional filters
   * @returns Number of agents
   */
  getAgentCount(options: { status?: AgentStatus } = {}): number {
    return this.getAllAgents(options).length;
  }

  /**
   * Add a configuration for an agent
   * @param agentName - The agent name
   * @param configuration - The agent configuration
   */
  addAgentConfiguration(agentName: string, configuration: any): void {
    if (!configuration.id) {
      throw new Error('Agent configuration must include an ID');
    }
    
    this.agentConfigurations.set(configuration.id, {
      id: configuration.id,
      name: agentName,
      capabilities: configuration.capabilities || [],
      metadata: configuration.metadata || {},
      configuredAt: new Date().toISOString()
    });
    
    // Check if the agent is already connected and update its information
    const agent = this.findAgentByName(agentName);
    if (agent) {
      agent.capabilities = configuration.capabilities || agent.capabilities;
      if (configuration.metadata) {
        agent.manifest = agent.manifest || {};
        agent.manifest.metadata = { 
          ...(agent.manifest.metadata || {}), 
          ...configuration.metadata 
        };
      }
    }
  }

  /**
   * Set configuration for an agent by ID
   * @param agentId - The agent ID
   * @param configuration - The configuration object
   * @returns The agent configuration
   */
  setAgentConfiguration(agentId: string, configuration: {
    name: string;
    capabilities?: string[];
    metadata?: Record<string, any>;
  }): AgentConfiguration {
    // Create the agent configuration
    const agentConfig: AgentConfiguration = {
      id: agentId,
      name: configuration.name,
      capabilities: configuration.capabilities || [],
      metadata: configuration.metadata || {},
      configuredAt: new Date().toISOString()
    };
    
    // Store the configuration
    this.agentConfigurations.set(agentId, agentConfig);
    
    // Update the agent if it exists
    const agent = this.getAgentById(agentId);
    if (agent) {
      agent.name = configuration.name;
      agent.capabilities = configuration.capabilities || agent.capabilities;
      if (configuration.metadata) {
        agent.manifest = agent.manifest || {};
        agent.manifest.metadata = { 
          ...(agent.manifest.metadata || {}), 
          ...configuration.metadata 
        };
      }
      
      // Update in the registry
      for (const connectedAgent of this.connectedAgents.values()) {
        if (connectedAgent.agent.id === agentId) {
          connectedAgent.agent = agent;
          break;
        }
      }
    }
    
    return agentConfig;
  }

  /**
   * Get configuration for an agent by ID
   * @param agentId - The agent ID
   * @returns The agent configuration or null if not found
   */
  getAgentConfiguration(agentId: string): AgentConfiguration | null {
    return this.agentConfigurations.get(agentId) || null;
  }

  /**
   * Get configuration for an agent by name
   * @param name - The agent name
   * @returns The agent configuration or null if not found
   */
  getAgentConfigurationByName(name: string): AgentConfiguration | null {
    for (const config of this.agentConfigurations.values()) {
      if (config.name === name) {
        return config;
      }
    }
    
    return null;
  }
} 