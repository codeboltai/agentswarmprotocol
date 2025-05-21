"use strict";
/**
 * Agent Registry for the ASP Orchestrator
 * Responsible for managing agent registrations, capabilities, and connections
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
class AgentRegistry {
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
    addPendingConnection(connectionId, connection) {
        const pendingConnection = {
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
    getPendingConnection(connectionId) {
        return this.pendingConnections.get(connectionId);
    }
    /**
     * Find an agent by name
     * @param name - Name of the agent to find
     * @returns The agent or undefined if not found
     */
    findAgentByName(name) {
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
    registerAgent(agent, connectionId) {
        if (!agent.id) {
            throw new Error('Agent ID is required');
        }
        if (!agent.name) {
            throw new Error('Agent name is required');
        }
        // Check if an agent with the same name already exists but with a different ID
        const existingAgentWithSameName = this.findAgentByName(agent.name);
        if (existingAgentWithSameName && existingAgentWithSameName.id !== agent.id) {
            // If an agent with the same name exists but with a different ID, update its status to offline
            existingAgentWithSameName.status = 'offline';
            // Remove any connected agent entry with the same name if it exists
            for (const [connId, connectedAgent] of this.connectedAgents.entries()) {
                if (connectedAgent.agent.id === existingAgentWithSameName.id) {
                    // Update agent status
                    connectedAgent.agent.status = 'offline';
                    connectedAgent.agent.statusDetails = {
                        disconnectedAt: new Date().toISOString(),
                        disconnectedReason: 'Replaced by agent with same name'
                    };
                    break;
                }
            }
        }
        // If connectionId is provided, use it to create/update a connected agent
        if (connectionId) {
            // Get the connection from pending connections
            const pendingConnection = this.pendingConnections.get(connectionId);
            if (pendingConnection) {
                // If the agent already exists with another connection, update it
                let existingEntry;
                // Search for existing agent by ID
                for (const [existingConnId, connectedAgent] of this.connectedAgents.entries()) {
                    if (connectedAgent.agent.id === agent.id) {
                        existingEntry = connectedAgent;
                        // If an agent is found with a different connection, mark it as inactive
                        if (existingConnId !== connectionId) {
                            this.connectedAgents.delete(existingConnId);
                        }
                        break;
                    }
                }
                // Create a connected agent entry (new or updated)
                const connectedAgent = {
                    agent: {
                        ...agent,
                        status: 'online',
                        connectionId
                    },
                    connection: pendingConnection.connection
                };
                this.connectedAgents.set(connectionId, connectedAgent);
                // Remove from pending connections
                this.pendingConnections.delete(connectionId);
            }
        }
        else {
            // No connection provided - create an offline agent entry with a null connection ID
            // We'll store this in the connectedAgents map with status 'offline' for consistency
            const offlineAgent = {
                agent: {
                    ...agent,
                    status: 'offline',
                    connectionId: `offline_${agent.id}`
                },
                connection: null
            };
            this.connectedAgents.set(offlineAgent.agent.connectionId, offlineAgent);
        }
        return agent;
    }
    /**
     * Get a WebSocket connection by connection ID
     * @param connectionId - The connection ID
     * @returns The WebSocket connection object or undefined if not found
     */
    getConnection(connectionId) {
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
    getConnectedAgent(connectionId) {
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
    getConnectionByAgentId(agentId) {
        // Find agent in connected agents with online status
        for (const connectedAgent of this.connectedAgents.values()) {
            if (connectedAgent.agent.id === agentId && connectedAgent.agent.status === 'online') {
                return connectedAgent.connection;
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
    associateAgentWithConnection(agentId, connectionId) {
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
        const connectedAgent = {
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
    removeConnection(connectionId) {
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
    getAgentById(agentId) {
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
    getAgentByName(agentName) {
        return this.findAgentByName(agentName);
    }
    /**
     * Get an agent by connection ID
     * @param connectionId - The connection ID
     * @returns The agent or undefined if not found
     */
    getAgentByConnectionId(connectionId) {
        const connectedAgent = this.connectedAgents.get(connectionId);
        return connectedAgent ? connectedAgent.agent : undefined;
    }
    /**
     * Get all agents, optionally filtered by status and capabilities
     * @param options - Optional filters
     * @returns Array of agents
     */
    getAllAgents(options = {}) {
        const { status, capabilities } = options;
        let result = [];
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
            result = result.filter(agent => capabilities.every(cap => agent.capabilities?.includes(cap)));
        }
        return result;
    }
    /**
     * Get all connected agents (with online status)
     * @returns Array of connected agent objects
     */
    getAllConnectedAgents() {
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
    updateAgentStatus(agentId, status, details) {
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
    removeAgent(agentId) {
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
    findAgentsByCapabilities(capabilities, options = {}) {
        const agents = this.getAllAgents(options);
        return agents.filter(agent => capabilities.every(cap => agent.capabilities?.includes(cap)));
    }
    /**
     * Get the count of agents, optionally filtered by status
     * @param options - Optional filters
     * @returns Number of agents
     */
    getAgentCount(options = {}) {
        return this.getAllAgents(options).length;
    }
    /**
     * Add a configuration for an agent
     * @param agentName - The agent name
     * @param configuration - The agent configuration
     */
    addAgentConfiguration(agentName, configuration) {
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
    setAgentConfiguration(agentId, configuration) {
        // Create the agent configuration
        const agentConfig = {
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
    getAgentConfiguration(agentId) {
        return this.agentConfigurations.get(agentId) || null;
    }
    /**
     * Get configuration for an agent by name
     * @param name - The agent name
     * @returns The agent configuration or null if not found
     */
    getAgentConfigurationByName(name) {
        for (const config of this.agentConfigurations.values()) {
            if (config.name === name) {
                return config;
            }
        }
        return null;
    }
}
exports.AgentRegistry = AgentRegistry;
