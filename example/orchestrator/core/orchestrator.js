/**
 * Orchestrator for Agent Swarm Protocol
 * Manages agents, services, and tasks within the ASP ecosystem
 */
class Orchestrator {
  constructor() {
    this.agents = {};
    this.services = {};
    this.tasks = {};
    this.statistics = {
      totalAgents: 0,
      totalServices: 0,
      totalTasks: 0,
      completedTasks: 0,
      tasksInProgress: 0,
      pendingTasks: 0,
      failedTasks: 0,
      serviceUsage: {}
    };
  }

  /**
   * Register a new agent in the system
   * @param {Object} agentInfo - Agent information
   * @param {string} agentInfo.id - Unique ID for the agent
   * @param {string} agentInfo.name - Human-readable name
   * @param {string} agentInfo.type - Type of agent
   * @param {string[]} agentInfo.capabilities - List of agent capabilities
   * @param {Object} [agentInfo.metadata] - Additional metadata
   * @returns {Object} - Registered agent
   */
  registerAgent(agentInfo) {
    const agent = {
      ...agentInfo,
      status: 'online',
      registeredAt: new Date().toISOString(),
      tasks: []
    };

    this.agents[agent.id] = agent;
    this.statistics.totalAgents++;

    return agent;
  }

  /**
   * Update agent status
   * @param {string} agentId - ID of the agent
   * @param {string} status - New status (online, offline, busy)
   * @returns {Object} - Updated agent
   */
  updateAgentStatus(agentId, status) {
    if (!this.agents[agentId]) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    this.agents[agentId].status = status;
    
    // If agent goes offline, update assigned tasks
    if (status === 'offline') {
      this.agents[agentId].tasks.forEach(taskId => {
        if (this.tasks[taskId].status === 'in_progress') {
          this.tasks[taskId].status = 'pending';
          this.statistics.tasksInProgress--;
          this.statistics.pendingTasks++;
        }
      });
    }

    return this.agents[agentId];
  }

  /**
   * Get agent information
   * @param {string} agentId - ID of the agent
   * @returns {Object} - Agent information
   */
  getAgent(agentId) {
    if (!this.agents[agentId]) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    return this.agents[agentId];
  }

  /**
   * Get all registered agents
   * @returns {Object[]} - Array of agents
   */
  getAllAgents() {
    return Object.values(this.agents);
  }

  /**
   * Register a service provided by an agent
   * @param {Object} serviceInfo - Service information
   * @param {string} serviceInfo.name - Service name
   * @param {string} serviceInfo.providerId - ID of the provider agent
   * @param {string} serviceInfo.category - Category of the service
   * @param {Object} serviceInfo.schema - Input/output schema
   * @param {Object} [serviceInfo.metadata] - Additional metadata
   * @returns {Object} - Registered service
   */
  registerService(serviceInfo) {
    const serviceId = `${serviceInfo.providerId}:${serviceInfo.name}`;
    
    if (!this.agents[serviceInfo.providerId]) {
      throw new Error(`Provider agent with ID ${serviceInfo.providerId} not found`);
    }

    const service = {
      id: serviceId,
      ...serviceInfo,
      registeredAt: new Date().toISOString(),
      usageCount: 0
    };

    this.services[serviceId] = service;
    this.statistics.totalServices++;
    this.statistics.serviceUsage[serviceInfo.name] = 0;

    return service;
  }

  /**
   * Get service information
   * @param {string} serviceId - ID of the service
   * @returns {Object} - Service information
   */
  getService(serviceId) {
    if (!this.services[serviceId]) {
      throw new Error(`Service with ID ${serviceId} not found`);
    }
    return this.services[serviceId];
  }

  /**
   * Get all registered services
   * @returns {Object[]} - Array of services
   */
  getAllServices() {
    return Object.values(this.services);
  }

  /**
   * Get all services of a specific type
   * @param {string} category - Category of services to retrieve
   * @returns {Object[]} - Array of matching services
   */
  getServicesByCategory(category) {
    return Object.values(this.services).filter(service => 
      service.category === category
    );
  }

  /**
   * Create a new task
   * @param {Object} taskInfo - Task information
   * @param {string} taskInfo.type - Type of task
   * @param {string} taskInfo.name - Human-readable name
   * @param {string} taskInfo.description - Detailed description
   * @param {Object} taskInfo.input - Input data
   * @param {string} taskInfo.requesterId - ID of the requesting agent
   * @param {Object} [taskInfo.metadata] - Additional metadata
   * @returns {Object} - Created task
   */
  createTask(taskInfo) {
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const task = {
      id: taskId,
      ...taskInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      assignedTo: null,
      updates: [],
      result: null
    };

    this.tasks[taskId] = task;
    this.statistics.totalTasks++;
    this.statistics.pendingTasks++;

    return task;
  }

  /**
   * Assign a task to an agent
   * @param {string} taskId - ID of the task
   * @param {string} agentId - ID of the agent
   * @returns {Object} - Updated task
   */
  assignTask(taskId, agentId) {
    if (!this.tasks[taskId]) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    if (!this.agents[agentId]) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    // Update task
    this.tasks[taskId].assignedTo = agentId;
    this.tasks[taskId].assignedAt = new Date().toISOString();
    
    // Add task to agent's list
    this.agents[agentId].tasks.push(taskId);

    return this.tasks[taskId];
  }

  /**
   * Update status of a task
   * @param {string} taskId - ID of the task
   * @param {string} status - New status (pending, in_progress, completed, failed)
   * @param {Object} [update] - Status update information
   * @returns {Object} - Updated task
   */
  updateTaskStatus(taskId, status, update = {}) {
    if (!this.tasks[taskId]) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const task = this.tasks[taskId];
    const previousStatus = task.status;
    
    // Update statistics
    if (previousStatus !== status) {
      if (previousStatus === 'pending') this.statistics.pendingTasks--;
      if (previousStatus === 'in_progress') this.statistics.tasksInProgress--;
      if (previousStatus === 'completed') this.statistics.completedTasks--;
      if (previousStatus === 'failed') this.statistics.failedTasks--;
      
      if (status === 'pending') this.statistics.pendingTasks++;
      if (status === 'in_progress') this.statistics.tasksInProgress++;
      if (status === 'completed') this.statistics.completedTasks++;
      if (status === 'failed') this.statistics.failedTasks++;
    }
    
    // Update task
    task.status = status;
    
    // Add update to history
    const updateInfo = {
      status,
      timestamp: new Date().toISOString(),
      ...update
    };
    
    task.updates.push(updateInfo);
    
    // If result is provided, add it to the task
    if (update.result) {
      task.result = update.result;
    }
    
    return task;
  }

  /**
   * Get task information
   * @param {string} taskId - ID of the task
   * @returns {Object} - Task information
   */
  getTask(taskId) {
    if (!this.tasks[taskId]) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    return this.tasks[taskId];
  }

  /**
   * Get all tasks assigned to an agent
   * @param {string} agentId - ID of the agent
   * @returns {Object[]} - Array of tasks
   */
  getTasksByAgent(agentId) {
    if (!this.agents[agentId]) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    return this.agents[agentId].tasks.map(taskId => this.tasks[taskId]);
  }

  /**
   * Find agents suitable for a task based on required capabilities
   * @param {Object} task - Task object
   * @param {string[]} requiredCapabilities - List of required capabilities
   * @returns {Object[]} - Array of suitable agents
   */
  findAgentsForTask(task, requiredCapabilities) {
    return Object.values(this.agents).filter(agent => {
      // Check if agent is online
      if (agent.status !== 'online') return false;
      
      // Check if agent has all required capabilities
      return requiredCapabilities.every(capability => 
        agent.capabilities.includes(capability)
      );
    });
  }

  /**
   * Get recommended services for a task
   * @param {Object} task - Task object
   * @param {string} category - Category of services to consider
   * @returns {Object[]} - Array of recommended services
   */
  getRecommendedServices(task, category) {
    // Get services in the specified category
    const relevantServices = this.getServicesByCategory(category);
    
    // Find services provided by agents with matching capabilities
    const recommended = relevantServices.filter(service => {
      const provider = this.agents[service.providerId];
      return provider && provider.status === 'online';
    });
    
    return recommended;
  }

  /**
   * Get system statistics
   * @returns {Object} - System statistics
   */
  getStatistics() {
    // Ensure statistics are up to date
    this.statistics.onlineAgents = Object.values(this.agents)
      .filter(agent => agent.status === 'online').length;
      
    return { ...this.statistics };
  }
}

module.exports = { Orchestrator }; 