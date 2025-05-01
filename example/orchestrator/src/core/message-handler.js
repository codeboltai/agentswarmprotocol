const { v4: uuidv4 } = require('uuid');

/**
 * MessageHandler - Centralizes business logic for handling messages in ASP
 * Processes messages from clients and agents, coordinates tasks and services
 */
class MessageHandler {
  constructor({ agents, tasks, services, eventBus, mcp }) {
    this.agents = agents;
    this.tasks = tasks;
    this.services = services;
    this.eventBus = eventBus;
    this.mcp = mcp;  // Add MCP adapter
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
    
    // Check if there's a pre-configured agent with this name
    const agentConfig = this.agents.getAgentConfigurationByName(name);
    
    // Register the agent
    const agent = {
      id: agentConfig ? agentConfig.id : uuidv4(),
      name,
      // Use pre-configured capabilities if available, otherwise use provided capabilities or default to empty array
      capabilities: agentConfig ? [...new Set([...agentConfig.capabilities, ...(capabilities || [])])] : capabilities || [],
      // Merge provided manifest with pre-configured metadata
      manifest: {
        ...(manifest || {}),
        ...(agentConfig ? { preconfigured: true, metadata: agentConfig.metadata } : {})
      },
      connectionId: connectionId,
      status: 'online',
      registeredAt: new Date().toISOString()
    };
    
    this.agents.registerAgent(agent);
    
    console.log(`Agent registered: ${name} with capabilities: ${agent.capabilities.join(', ')}`);
    if (agentConfig) {
      console.log(`Applied pre-configured settings for agent: ${name}`);
    }
    
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
    
    // Check if this is an MCP request
    if (service === 'mcp-service') {
      return this.handleMCPRequest(params, agent);
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
   * Handle MCP service request
   * @param {Object} params - MCP request parameters
   * @param {Object} agent - Requesting agent
   * @returns {Promise<Object>} MCP service result
   */
  async handleMCPRequest(params, agent) {
    const { action, mcpServerName, toolName, toolArgs, serverId } = params;
    
    if (!action) {
      throw new Error('MCP action is required');
    }
    
    switch (action) {
      case 'list-servers':
        return {
          servers: this.mcp.listMCPServers(params.filters || {})
        };
        
      case 'register-server':
        if (!params.name || !params.path) {
          throw new Error('Server name and path are required for registration');
        }
        return this.mcp.registerMCPServer({
          name: params.name,
          path: params.path,
          type: params.type || 'node',
          capabilities: params.capabilities || []
        });
        
      case 'connect-server':
        if (!serverId && !mcpServerName) {
          throw new Error('Either server ID or name is required to connect');
        }
        
        // If only name is provided, find server by name
        const serverToConnect = serverId || 
          (mcpServerName && this.mcp.getServerByName(mcpServerName)?.id);
        
        if (!serverToConnect) {
          throw new Error(`Server not found: ${mcpServerName}`);
        }
        
        return this.mcp.connectToMCPServer(serverToConnect);
        
      case 'disconnect-server':
        if (!serverId && !mcpServerName) {
          throw new Error('Either server ID or name is required to disconnect');
        }
        
        // If only name is provided, find server by name
        const serverToDisconnect = serverId || 
          (mcpServerName && this.mcp.getServerByName(mcpServerName)?.id);
        
        if (!serverToDisconnect) {
          throw new Error(`Server not found: ${mcpServerName}`);
        }
        
        return this.mcp.disconnectMCPServer(serverToDisconnect);
        
      case 'list-tools':
        if (!serverId && !mcpServerName) {
          throw new Error('Either server ID or name is required to list tools');
        }
        
        // If only name is provided, find server by name
        const serverForTools = serverId || 
          (mcpServerName && this.mcp.getServerByName(mcpServerName)?.id);
        
        if (!serverForTools) {
          throw new Error(`Server not found: ${mcpServerName}`);
        }
        
        return { tools: await this.mcp.listMCPTools(serverForTools) };
        
      case 'execute-tool':
        if (!mcpServerName && !serverId) {
          throw new Error('Server name or ID is required to execute a tool');
        }
        
        if (!toolName) {
          throw new Error('Tool name is required to execute a tool');
        }
        
        // Create a task for this MCP request
        const taskId = uuidv4();
        
        // Register the task
        this.tasks.registerTask(taskId, {
          agentId: agent.id,
          type: 'mcp-tool',
          status: 'pending',
          createdAt: new Date().toISOString(),
          mcpServer: mcpServerName || serverId,
          toolName,
          toolArgs
        });
        
        try {
          // Execute the MCP request
          const result = await this.eventBus.emit('agent.task.mcp', {
            content: {
              mcpServerName,
              serverId,
              toolName,
              toolArgs
            }
          }, agent.id, (response) => {
            // Update task status
            if (response.error) {
              this.tasks.updateTaskStatus(taskId, 'failed', { error: response.error });
              return response;
            } else {
              this.tasks.updateTaskStatus(taskId, 'completed', {
                result: response.result,
                metadata: response.metadata
              });
              return response;
            }
          });
          
          return {
            taskId,
            status: 'pending',
            message: `MCP tool execution initiated: ${toolName} on ${mcpServerName || serverId}`
          };
        } catch (error) {
          // Update task status
          this.tasks.updateTaskStatus(taskId, 'failed', { error: error.message });
          throw error;
        }
        
      default:
        throw new Error(`Unknown MCP action: ${action}`);
    }
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
    
    // Create a task ID
    const taskId = uuidv4();
    
    // Create the task message
    const taskMessage = {
      id: taskId,
      type: 'task.execute',
      requestId: message.id, // Set request ID to link response back
      content: {
        ...taskData,
        metadata: {
          requestingAgentId: requestingAgent.id,
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
    
    // Emit event to handle agent-to-agent request
    this.eventBus.emit('agent.request', taskId, targetAgent.id, requestingAgent.id, taskMessage);
    
    return {
      taskId,
      status: 'pending'
    };
  }

  /**
   * Handle task result
   * @param {Object} message - Task result message
   */
  handleTaskResult(message) {
    const { taskId, content } = message;
    
    if (!taskId) {
      console.error('Invalid task result: Task ID is required');
      return;
    }
    
    // Get the task
    const task = this.tasks.getTask(taskId);
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return;
    }
    
    // Update task status
    this.tasks.updateTaskStatus(taskId, 'completed', content);
    
    // Forward result to client if this was a client-initiated task
    if (task.clientId) {
      this.eventBus.emit('task.result', task.clientId, taskId, content);
    }
  }

  /**
   * Handle task error
   * @param {Object} message - Task error message
   */
  handleTaskError(message) {
    const { taskId, error } = message;
    
    if (!taskId) {
      console.error('Invalid task error: Task ID is required');
      return;
    }
    
    // Get the task
    const task = this.tasks.getTask(taskId);
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return;
    }
    
    // Update task status
    this.tasks.updateTaskStatus(taskId, 'failed', { error });
    
    // Forward error to client if this was a client-initiated task
    if (task.clientId) {
      this.eventBus.emit('task.error', task.clientId, {
        type: 'task.error',
        taskId,
        error
      });
    }
  }

  /**
   * Handle agent disconnection
   * @param {string} connectionId - Agent connection ID
   */
  handleAgentDisconnected(connectionId) {
    const agent = this.agents.getAgentByConnectionId(connectionId);
    if (!agent) {
      return;
    }
    
    // Update agent status
    this.agents.updateAgentStatus(agent.id, 'offline');
    
    // Find all pending tasks for this agent
    const pendingTasks = this.tasks.getTasksByAgentId(agent.id)
      .filter(task => task.status === 'pending');
    
    // Mark tasks as failed
    for (const task of pendingTasks) {
      this.tasks.updateTaskStatus(task.id, 'failed', {
        error: `Agent disconnected: ${agent.name}`
      });
      
      // Notify client if this was a client-initiated task
      if (task.clientId) {
        this.eventBus.emit('task.error', task.clientId, {
          type: 'task.error',
          taskId: task.id,
          error: `Agent disconnected: ${agent.name}`
        });
      }
    }
  }
}

module.exports = { MessageHandler }; 