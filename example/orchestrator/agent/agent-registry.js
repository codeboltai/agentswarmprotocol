/**
 * Agent Registry for the ASP Orchestrator
 * Responsible for managing agent registrations, capabilities, and connections
 */
class AgentRegistry {
  constructor() {
    this.agents = new Map(); // Maps agent IDs to agent objects
    this.agentsByName = new Map(); // Maps agent names to agent objects
    this.agentsByConnectionId = new Map(); // Maps connection IDs to agent objects
  }

  /**
   * Register a new agent or update an existing one
   * @param {Object} agent - The agent object to register
   * @returns {Object} The registered agent
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
   * @returns {Object|null} The agent object or null if not found
   */
  getAgentById(agentId) {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get an agent by name
   * @param {string} agentName - The name of the agent to get
   * @returns {Object|null} The agent object or null if not found
   */
  getAgentByName(agentName) {
    return this.agentsByName.get(agentName) || null;
  }

  /**
   * Get an agent by connection ID
   * @param {string} connectionId - The connection ID to look up
   * @returns {Object|null} The agent object or null if not found
   */
  getAgentByConnectionId(connectionId) {
    return this.agentsByConnectionId.get(connectionId) || null;
  }

  /**
   * Get all registered agents
   * @param {Object} options - Filter options
   * @param {string} options.status - Filter by agent status
   * @param {Array<string>} options.capabilities - Filter by agent capabilities
   * @returns {Array<Object>} List of matching agents
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
        return options.capabilities.every(cap => 
          agent.capabilities && agent.capabilities.includes(cap)
        );
      });
    }
    
    return agents;
  }

  /**
   * Update an agent's status
   * @param {string} agentId - The ID of the agent to update
   * @param {string} status - The new status
   * @returns {Object|null} The updated agent or null if not found
   */
  updateAgentStatus(agentId, status) {
    const agent = this.getAgentById(agentId);
    if (!agent) {
      return null;
    }
    
    agent.status = status;
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
   * @param {Array<string>} capabilities - List of required capabilities
   * @param {Object} options - Additional filter options
   * @param {string} options.status - Filter by agent status
   * @returns {Array<Object>} List of matching agents
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
   * @param {string} options.status - Count only agents with this status
   * @returns {number} The number of agents
   */
  getAgentCount(options = {}) {
    return this.getAllAgents(options).length;
  }
}

module.exports = { AgentRegistry }; 