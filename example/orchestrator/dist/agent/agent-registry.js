"use strict";
/**
 * Agent Registry for the ASP Orchestrator
 * Responsible for managing agent registrations, capabilities, and connections
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
class AgentRegistry {
    constructor() {
        this.agents = new Map(); // Maps agent IDs to agent objects
        this.agentsByName = new Map(); // Maps agent names to agent objects
        this.agentsByConnectionId = new Map(); // Maps connection IDs to agent objects
        this.agentConfigurations = new Map(); // Maps agent IDs to preconfigured settings
    }
    /**
     * Register a new agent or update an existing one
     * @param {Agent} agent - The agent object to register
     * @returns {Agent} The registered agent
     */
    registerAgent(agent) {
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
        // Store the agent
        this.agents.set(agent.id, agent);
        this.agentsByName.set(agent.name, agent);
        if (agent.connectionId) {
            this.agentsByConnectionId.set(agent.connectionId, agent);
        }
        return agent;
    }
    /**
     * Get an agent by ID
     * @param {string} agentId - The ID of the agent to get
     * @returns {Agent|undefined} The agent object or undefined if not found
     */
    getAgentById(agentId) {
        return this.agents.get(agentId);
    }
    /**
     * Get an agent by name
     * @param {string} agentName - The name of the agent to get
     * @returns {Agent|undefined} The agent object or undefined if not found
     */
    getAgentByName(agentName) {
        return this.agentsByName.get(agentName);
    }
    /**
     * Get an agent by connection ID
     * @param {string} connectionId - The connection ID to look up
     * @returns {Agent|undefined} The agent object or undefined if not found
     */
    getAgentByConnectionId(connectionId) {
        return this.agentsByConnectionId.get(connectionId);
    }
    /**
     * Get agent WebSocket connection by connection ID
     * @param connectionId - The connection ID of the agent
     * @returns The WebSocket connection object or undefined if not found
     */
    getAgentConnection(connectionId) {
        const agent = this.getAgentByConnectionId(connectionId);
        return agent?.connection;
    }
    /**
     * Get all registered agents
     * @param {Object} options - Filter options
     * @returns {Array<Agent>} List of matching agents
     */
    getAllAgents(options = {}) {
        let agents = Array.from(this.agents.values());
        // Filter by status if provided
        if (options.status) {
            agents = agents.filter(agent => agent.status === options.status);
        }
        // Filter by capabilities if provided
        if (options.capabilities && options.capabilities.length > 0) {
            agents = agents.filter(agent => {
                return options.capabilities.every(cap => agent.capabilities && agent.capabilities.includes(cap));
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
    updateAgentStatus(agentId, status, details) {
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
    removeAgent(agentId) {
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
        }
        return true;
    }
    /**
     * Remove an agent by connection ID
     * @param {string} connectionId - The connection ID of the agent to remove
     * @returns {boolean} True if the agent was removed, false otherwise
     */
    removeAgentByConnectionId(connectionId) {
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
    findAgentsByCapabilities(capabilities, options = {}) {
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
    getAgentCount(options = {}) {
        return this.getAllAgents(options).length;
    }
    /**
     * Add a configuration for an agent
     * @param {string} agentName - The name to associate with this configuration
     * @param {object} configuration - The agent configuration
     */
    addAgentConfiguration(agentName, configuration) {
        if (!agentName) {
            throw new Error('Agent name is required for configuration');
        }
        const agentConfig = {
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
    setAgentConfiguration(agentId, configuration) {
        if (!agentId) {
            throw new Error('Agent ID is required for configuration');
        }
        if (!configuration.name) {
            throw new Error('Agent name is required for configuration');
        }
        const agentConfig = {
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
    getAgentConfiguration(agentId) {
        return this.agentConfigurations.get(agentId) || null;
    }
    /**
     * Get an agent configuration by name
     * @param {string} name - The name of the configuration to get
     * @returns {any|null} The agent configuration or null if not found
     */
    getAgentConfigurationByName(name) {
        // Try to find a configuration with this name
        for (const config of this.agentConfigurations.values()) {
            if (config.name === name) {
                return config;
            }
        }
        return null;
    }
}
exports.AgentRegistry = AgentRegistry;
