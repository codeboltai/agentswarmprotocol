const { v4: uuidv4 } = require('uuid');

/**
 * MessageHandler - Centralizes business logic for handling messages in ASP
 * Processes messages from clients and agents, coordinates tasks and services
 */
class MessageHandler {
  constructor({ agents, tasks, services, eventBus }) {
    this.agents = agents;
    this.tasks = tasks;
    this.services = services;
    this.eventBus = eventBus;
  }

  /**
   * Handle a client task creation request
   * @param {Object} message - The task creation message
   * @param {string} clientId - The client's connection ID
   * @returns {Object} Task creation result
   */
  async handleTaskCreation(message, clientId) {
    const { agentName, taskData } = message.content;
    
    if (!agentName || !taskData) {
      throw new Error('Invalid task creation request: Both agentName and taskData are required');
    }
    
    // Find the agent by name
    const agent = this.agents.getAgentByName(agentName);
    if (!agent) {
      throw new Error(`Agent not found: No agent found with name '${agentName}'`);
    }
    
    // Create a task
    const taskId = uuidv4();
    const taskMessage = {
      id: taskId,
      type: 'task.execute',
      content: {
        input: taskData,
        metadata: {
          clientId: clientId,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    // Register task in task registry
    this.tasks.registerTask(taskId, {
      agentId: agent.id,
      clientId: clientId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      taskData
    });
    
    // Emit event for task creation
    this.eventBus.emit('task.created', taskId, agent.id, clientId, taskData);
    
    return {
      taskId,
      agentId: agent.id,
      status: 'pending'
    };
  }

  /**
   * Get information about a specific task
   * @param {string} taskId - The ID of the task
   * @returns {Object} Task information
   */
  getTaskStatus(taskId) {
    if (!taskId) {
      throw new Error('Invalid task status request: Task ID is required');
    }
    
    const task = this.tasks.getTask(taskId);
    
    return {
      taskId,
      status: task.status,
      result: task.result,
      createdAt: task.createdAt,
      completedAt: task.completedAt
    };
  }

  /**
   * Get list of available agents
   * @param {Object} filters - Optional filters for the agent list
   * @returns {Array} List of agents
   */
  getAgentList(filters = {}) {
    const agents = this.agents.getAllAgents(filters).map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      capabilities: agent.capabilities
    }));
    
    return agents;
  }

  /**
   * Handle agent registration
   * @param {Object} message - Registration message
   * @param {string} connectionId - Agent connection ID
   * @returns {Object} Registration result
   */
  handleAgentRegistration(message, connectionId) {
    const { name, capabilities, manifest } = message.content;
    
    if (!name) {
      throw new Error('Agent name is required');
    }
    
    // Register the agent
    const agent = {
      id: uuidv4(),
      name,
      capabilities: capabilities || [],
      manifest: manifest || {},
      connectionId: connectionId,
      status: 'online',
      registeredAt: new Date().toISOString()
    };
    
    this.agents.registerAgent(agent);
    
    console.log(`Agent registered: ${name} with capabilities: ${agent.capabilities.join(', ')}`);
    
    return {
      agentId: agent.id,
      name: agent.name,
      message: 'Agent successfully registered'
    };
  }

  /**
   * Handle service request from an agent
   * @param {Object} message - Service request message
   * @param {string} connectionId - Requesting agent's connection ID
   * @returns {Promise<Object>} Service result
   */
  async handleServiceRequest(message, connectionId) {
    const { service, params } = message.content;
    
    if (!service) {
      throw new Error('Service name is required');
    }
    
    // Get the agent making the request
    const agent = this.agents.getAgentByConnectionId(connectionId);
    if (!agent) {
      throw new Error('Agent not registered');
    }
    
    // Check if the service exists
    if (!this.services[service]) {
      throw new Error(`Service not found: ${service}`);
    }
    
    // Check if the agent is allowed to use this service
    if (agent.manifest.requiredServices && !agent.manifest.requiredServices.includes(service)) {
      throw new Error(`Agent is not authorized to use service: ${service}`);
    }
    
    // Execute the service
    const result = await this.services[service](params, { agent });
    return result;
  }

  /**
   * Handle agent-to-agent request
   * @param {Object} message - Agent request message
   * @param {string} connectionId - Requesting agent's connection ID
   * @returns {Object} Task information for tracking
   */
  handleAgentRequest(message, connectionId) {
    const { targetAgentName, taskData } = message.content;
    
    if (!targetAgentName) {
      throw new Error('Target agent name is required');
    }
    
    // Get the requesting agent
    const requestingAgent = this.agents.getAgentByConnectionId(connectionId);
    if (!requestingAgent) {
      throw new Error('Requesting agent not registered');
    }
    
    // Get the target agent
    const targetAgent = this.agents.getAgentByName(targetAgentName);
    if (!targetAgent) {
      throw new Error(`Target agent not found: ${targetAgentName}`);
    }
    
    // Check if target agent is online
    if (targetAgent.status !== 'online') {
      throw new Error(`Target agent is not available: ${targetAgentName} (status: ${targetAgent.status})`);
    }
    
    // Create a task for the target agent
    const taskId = uuidv4();
    const taskMessage = {
      id: taskId,
      type: 'task.execute',
      content: {
        input: taskData,
        metadata: {
          requestingAgentId: requestingAgent.id,
          requestingAgentName: requestingAgent.name,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    // Register task in task registry
    this.tasks.registerTask(taskId, {
      agentId: targetAgent.id,
      requestingAgentId: requestingAgent.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      taskData
    });
    
    // Emit event for agent-to-agent request
    this.eventBus.emit('agent.request', taskId, targetAgent.id, requestingAgent.id, taskMessage);
    
    return {
      taskId,
      targetAgentId: targetAgent.id,
      status: 'pending'
    };
  }

  /**
   * Handle task result from an agent
   * @param {Object} message - Task result message
   */
  handleTaskResult(message) {
    const { requestId, content } = message;
    
    if (requestId && this.tasks.hasTask(requestId)) {
      // Update task status
      const task = this.tasks.updateTaskStatus(requestId, 'completed', content);
      
      // Emit task completion event
      if (task.clientId) {
        this.eventBus.emit('task.result', task.clientId, requestId, content);
      }
    }
  }

  /**
   * Handle task error from an agent
   * @param {Object} message - Task error message
   */
  handleTaskError(message) {
    if (message.requestId && this.tasks.hasTask(message.requestId)) {
      const task = this.tasks.updateTaskStatus(message.requestId, 'failed', message.content);
      
      if (task.clientId) {
        this.eventBus.emit('task.error', task.clientId, message);
      }
    }
  }

  /**
   * Handle agent disconnection
   * @param {string} connectionId - ID of the disconnected connection
   */
  handleAgentDisconnected(connectionId) {
    // Get the agent by connection ID
    const agent = this.agents.getAgentByConnectionId(connectionId);
    
    if (agent) {
      console.log(`Agent ${agent.name} (${agent.id}) disconnected`);
      
      // Update agent status to offline
      agent.status = 'offline';
      agent.connection = null;
      this.agents.registerAgent(agent);
      
      // Handle any in-progress tasks
      const tasks = this.tasks.getTasksByAgentId(agent.id);
      tasks.forEach(task => {
        if (task.status === 'pending' || task.status === 'in_progress') {
          this.tasks.updateTaskStatus(task.id, 'failed', {
            error: 'Agent disconnected while task was in progress'
          });
          
          // Notify client if this was a client-initiated task
          if (task.clientId) {
            this.eventBus.emit('task.error', task.clientId, {
              requestId: task.id,
              content: {
                error: `Agent ${agent.name} disconnected while processing task`
              }
            });
          }
        }
      });
      
      // Emit event for agent status change
      this.eventBus.emit('agent.status_changed', agent.id, 'offline');
      
      return true;
    }
    
    return false;
  }
}

module.exports = { MessageHandler }; 