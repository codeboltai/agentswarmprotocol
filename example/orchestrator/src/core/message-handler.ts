import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  Task,
  Service,
  MCPServer,
  MCPTool,
  AgentStatus,
  ServiceStatus,
  TaskStatus,
  AgentRegistry,
  AgentTaskRegistry,
  ServiceTaskRegistry,
  ServiceRegistry as IServiceRegistry,
  MCPInterface,
  BaseMessage,
  MessageHandlerConfig
} from '../../../types/common';
import {
  AgentMessages,
  ClientMessages,
  ServiceMessages
} from '@agentswarmprotocol/types/dist/messages';
import { EventEmitter } from 'events';
import { ServiceRegistry } from '../registry/service-registry';
import { ClientRegistry, Client } from '../registry/client-registry';

// Extend MessageHandlerConfig to include clients
interface ExtendedMessageHandlerConfig extends MessageHandlerConfig {
  clients?: ClientRegistry;
}

/**
 * MessageHandler - Centralizes business logic for handling messages in ASP
 * Processes messages from clients and agents, coordinates tasks and services
 */
class MessageHandler {
  private agents: AgentRegistry;
  private tasks: AgentTaskRegistry;
  private services: ServiceRegistry;
  private serviceTasks?: ServiceTaskRegistry;
  private clients?: ClientRegistry;
  private eventBus: EventEmitter;
  private mcp: MCPInterface;

  constructor(config: ExtendedMessageHandlerConfig) {
    this.agents = config.agents;
    this.tasks = config.tasks;
    this.services = config.services as ServiceRegistry;
    this.serviceTasks = config.serviceTasks;
    this.clients = config.clients;
    this.eventBus = config.eventBus;
    this.mcp = config.mcp;
    
    // No longer setting up event listeners here - will be set up in index.ts
  }

  /**
   * Handle agent registered event
   * @param agentId The ID of the registered agent
   * @param connectionId The connection ID of the agent
   */
  handleAgentRegistered(agentId: string, connectionId: string): void {
    // Perform any additional business logic needed when an agent is registered
    console.log(`MessageHandler: Agent ${agentId} registered with connection ${connectionId}`);
    
    // For example, initialize any tasks or settings for the agent
    // Or notify other components about the new agent
  }

  /**
   * Handle client registered event
   * @param client The client that was registered
   */
  handleClientRegistered(client: Client): void {
    // Perform any additional business logic needed when a client is registered
    console.log(`MessageHandler: Client ${client.id} registered${client.name ? ` as ${client.name}` : ''}`);
    
    // For example, initialize any settings for the client
    // Or notify other components about the new client
  }

  /**
   * Handle client list request
   * @param filters Optional filters for the client list
   * @param requestId Optional request ID for tracking the response
   */
  handleClientListRequest(filters: any, requestId?: string): void {
    try {
      const clientList = this.getClientList(filters);
      // Emit result event with the request ID
      this.eventBus.emit(`client.list.result.${requestId || 'default'}`, clientList);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.list.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle agent list request
   * @param filters Optional filters for the agent list
   * @param requestId Optional request ID for tracking the response
   */
  handleAgentListRequest(filters: any, requestId?: string): void {
    try {
      const agentList = this.getAgentList(filters);
      // Emit result event with the request ID
      this.eventBus.emit(`agent.list.result.${requestId || 'default'}`, agentList);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`agent.list.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Get list of registered clients
   * @param {Object} filters - Optional filters for the client list
   * @returns {Array} List of clients
   */
  getClientList(filters: { status?: string } = {}) {
    if (!this.clients) return [];
    
    return this.clients.getAllClients({
      status: filters.status as any
    }).map(client => ({
      id: client.id,
      name: client.name,
      status: client.status,
      registeredAt: client.registeredAt,
      lastActiveAt: client.lastActiveAt
    }));
  }

  /**
   * Handle client disconnection
   * @param connectionId The connection ID of the client
   */
  handleClientDisconnected(connectionId: string): void {
    if (!this.clients) return;
    
    const client = this.clients.handleDisconnection(connectionId);
    if (client) {
      console.log(`Client disconnected: ${client.id}${client.name ? ` (${client.name})` : ''}`);
      // Emit event for client disconnection
      this.eventBus.emit('client.disconnected', client);
    }
  }

  /**
   * Handle a client task creation request
   * @param {BaseMessage} message - The task creation message
   * @param {string} clientId - The client's connection ID
   * @returns {Object} Task creation result
   */
  async handleTaskCreation(message: BaseMessage, clientId: string) {
    const { agentName, agentId, taskData } = message.content;

    console.log(`Task creation request received: ${JSON.stringify({
      agentName,
      agentId,
      hasTaskData: !!taskData,
      taskDataType: taskData ? typeof taskData : 'undefined',
      taskDataKeys: taskData && typeof taskData === 'object' ? Object.keys(taskData) : []
    })}`);

    if (!taskData) {
      throw new Error('Invalid task creation request: taskData is required');
    }

    // Allow direct targeting by ID or lookup by name
    let agent: Agent | undefined;

    if (agentId) {
      // Find agent directly by ID
      agent = this.agents.getAgentById(agentId);
      if (!agent) {
        throw new Error(`Agent not found: No agent found with ID '${agentId}'`);
      }
    } else if (agentName) {
      // Find the agent by name
      agent = this.agents.getAgentByName(agentName);
      if (!agent) {
        throw new Error(`Agent not found: No agent found with name '${agentName}'`);
      }
    } else {
      throw new Error('Invalid task creation request: Either agentName or agentId is required');
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
  getTaskStatus(taskId: string) {
    if (!taskId) {
      throw new Error('Invalid task status request: Task ID is required');
    }

    try {
      const task = this.tasks.getTask(taskId);

      return {
        taskId,
        status: task.status,
        result: task.result,
        createdAt: task.createdAt,
        completedAt: task.completedAt
      };
    } catch (error) {
      throw new Error(`Task not found: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get list of available agents
   * @param {Object} filters - Optional filters for the agent list
   * @returns {Array} List of agents
   */
  getAgentList(filters: { status?: string; capabilities?: string[] } = {}) {
    const agents = this.agents.getAllAgents(filters).map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      capabilities: agent.capabilities
    }));

    return agents;
  }

  /**
   * Handle service task execute request messages
   * @param {AgentMessages.ServiceRequestMessage | ServiceMessages.ServiceTaskExecuteMessage} message - The service request message
   * @param {string} connectionId - Agent connection ID
   * @returns {Object} Service result
   */
  async handleServiceTaskExecuteRequest(
    message: AgentMessages.ServiceRequestMessage | ServiceMessages.ServiceTaskExecuteMessage | any,
    connectionId: string
  ): Promise<any> {
    // Handle both service.request and service.task.execute message formats
    const messageContent = message.content || {};
    const service = messageContent.service || messageContent.serviceId;
    const params = messageContent.params || {};
    const toolName = messageContent.toolName || params?.functionName;

    if (!service) {
      throw new Error('Service name or ID is required');
    }

    // Get the agent making the request
    const agent = this.agents.getAgentByConnectionId(connectionId);
    if (!agent) {
      throw new Error('Agent not registered');
    }

    // Check if this is an MCP request
    if (service === 'mcp-service') {
      return this.handleMCPRequest(params as any, agent);
    }

    // Check if the service exists - try by name or ID
    let serviceObj = this.services.getServiceByName(service);
    if (!serviceObj) {
      serviceObj = this.services.getServiceById(service);
    }

    if (!serviceObj) {
      throw new Error(`Service not found: ${service}`);
    }

    // Check if the agent is allowed to use this service
    if (agent.manifest?.requiredServices && !agent.manifest.requiredServices.includes(serviceObj.name)) {
      throw new Error(`Agent is not authorized to use service: ${serviceObj.name}`);
    }

    // Create a service task
    const taskId = uuidv4();

    // Emit event for service task creation
    this.eventBus.emit('service.task.created', taskId, serviceObj.id, agent.id, null, {
      functionName: toolName || 'default',
      params: params || {}
    });

    // Wait for result (this will be resolved by the orchestrator)
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.eventBus.removeListener('service.task.completed', resultHandler);
        this.eventBus.removeListener('service.task.failed', errorHandler);
        reject(new Error(`Service task timeout: ${taskId}`));
      }, 30000); // 30 second timeout

      const resultHandler = (completedTaskId: string, result: any) => {
        if (completedTaskId === taskId) {
          clearTimeout(timeoutId);
          this.eventBus.removeListener('service.task.completed', resultHandler);
          this.eventBus.removeListener('service.task.failed', errorHandler);
          resolve(result);
        }
      };

      const errorHandler = (failedTaskId: string, error: any) => {
        if (failedTaskId === taskId) {
          clearTimeout(timeoutId);
          this.eventBus.removeListener('service.task.completed', resultHandler);
          this.eventBus.removeListener('service.task.failed', errorHandler);
          reject(error);
        }
      };

      this.eventBus.on('service.task.completed', resultHandler);
      this.eventBus.on('service.task.failed', errorHandler);
    });
  }

  /**
   * Handle service task execute event
   * @param message The service task message
   * @param connectionId The connection ID
   * @param requestId The request ID for tracking the response
   */
  async handleServiceTaskExecuteEvent(message: any, connectionId: string, requestId?: string): Promise<void> {
    try {
      // Execute the service task and get the result
      const result = await this.handleServiceTaskExecuteRequest(message, connectionId);
      
      // Emit the result event with the request ID
      this.eventBus.emit(`service.task.execute.result.${requestId || 'default'}`, result);
    } catch (error) {
      // Emit the error event with the request ID
      this.eventBus.emit(`service.task.execute.error.${requestId || 'default'}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle MCP service request
   * @param params - MCP request parameters
   * @param agent - Requesting agent
   * @returns MCP service result
   */
  async handleMCPRequest(params: any, agent: Agent): Promise<any> {
    const { action, mcpServerName, toolName, toolArgs, serverId, parameters } = params;

    switch (action) {
      case 'list-servers':
        return this.handleMCPServersListRequest(agent);

      case 'list-tools':
        if (!serverId) {
          throw new Error('Server ID is required to list tools');
        }
        return this.handleMCPToolsListRequest(serverId, agent);

      case 'execute-tool':
        if (!serverId || !toolName) {
          throw new Error('Server ID and tool name are required to execute a tool');
        }
        return this.handleMCPToolExecuteRequest(
          serverId,
          toolName,
          toolArgs || parameters || {},
          agent
        );

      default:
        throw new Error(`Invalid MCP action: ${action}`);
    }
  }

  /**
   * Handle request for list of MCP servers
   * @param agent - The requesting agent
   * @returns List of MCP servers
   */
  async handleMCPServersListRequest(agent: Agent): Promise<any> {
    const servers = this.mcp.getServerList();
    return {
      servers
    };
  }

  /**
   * Handle request for list of tools for an MCP server
   * @param serverId - The ID of the server
   * @param agent - The requesting agent
   * @returns List of MCP tools
   */
  async handleMCPToolsListRequest(serverId: string, agent: Agent): Promise<any> {
    const tools = await this.mcp.getToolList(serverId);
    const servers = this.mcp.getServerList();
    const serverInfo = servers.find(server => server.id === serverId);

    return {
      serverId,
      serverName: serverInfo?.name || 'unknown',
      tools
    };
  }

  /**
   * Handle request to execute a tool on an MCP server
   * @param serverId - The ID of the server
   * @param toolName - The name of the tool to execute
   * @param args - Tool arguments
   * @param agent - The requesting agent
   * @returns Tool execution result
   */
  async handleMCPToolExecuteRequest(serverId: string, toolName: string, args: any, agent: Agent): Promise<any> {
    try {
      const result = await this.mcp.executeServerTool(serverId, toolName, args);

      return {
        serverId,
        toolName,
        status: 'success',
        result
      };
    } catch (error) {
      return {
        serverId,
        toolName,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Handle service disconnection
   * @param connectionId - ID of the disconnected service
   */
  handleServiceDisconnected(connectionId: string): void {
    const service = this.services.getServiceByConnectionId(connectionId);

    if (service) {
      console.log(`Service disconnected: ${service.name}`);
      this.services.updateServiceStatus(service.id, 'offline', { disconnectedAt: new Date().toISOString() });
    }
  }

  /**
   * Handle agent disconnection
   * @param connectionId - The connection ID of the disconnected agent
   */
  handleAgentDisconnected(connectionId: string): void {
    // Get the agent before removing the connection
    const agent = this.agents.getAgentByConnectionId(connectionId);
    
    if (agent) {
      console.log(`Agent disconnected: ${agent.name} (${agent.id})`);
      
      // Update agent status to offline
      this.agents.updateAgentStatus(agent.id, 'offline', {
        disconnectedAt: new Date().toISOString(),
        lastConnectionId: connectionId
      });
      
      // Emit event for agent disconnection
      this.eventBus.emit('agent.status.changed', agent.id, 'offline');
      
      // Cancel any pending tasks for this agent
      this.handleAgentTasksOnDisconnect(agent.id);
    } else {
      console.log(`Unknown agent disconnected with connection ID: ${connectionId}`);
    }
  }

  /**
   * Handle pending tasks when an agent disconnects
   * @param agentId - The ID of the disconnected agent
   */
  private handleAgentTasksOnDisconnect(agentId: string): void {
    // Find all tasks assigned to this agent that are still pending or in_progress
    const agentTasks = this.tasks.getTasks({
      agentId,
      status: ['pending', 'in_progress']
    });
    
    if (agentTasks.length > 0) {
      console.log(`Handling ${agentTasks.length} pending tasks for disconnected agent ${agentId}`);
      
      // Update status for all tasks
      for (const task of agentTasks) {
        this.tasks.updateTaskStatus(task.id, 'failed', {
          error: 'Agent disconnected before task completion',
          disconnectedAt: new Date().toISOString()
        });
        
        // If there's a client waiting for this task, notify them
        if (task.clientId) {
          this.eventBus.emit('task.error', task.clientId, task.id, {
            message: 'Agent disconnected before task completion',
            taskId: task.id,
            agentId
          });
        }
      }
    }
  }

  /**
   * Handle an incoming message
   * @param message The message to handle
   * @param connectionId ID of the connection that sent the message
   * @returns Response message if needed
   */
  handleMessage(message: any, connectionId: string): any {
    const { type } = message;

    switch (type) {
      case 'agent.register':
        // Agent registration is now handled by the AgentServer
        this.eventBus.emit('agent.register.delegated', message, connectionId);
        return;

      case 'service.register':
        return this.handleServiceRegistration(message, connectionId);

      case 'service.task.execute':
        return this.handleServiceTaskExecuteRequest(message, connectionId);

      case 'task.result':
        this.eventBus.emit('task.result', message);
        return;

      case 'task.status':
        // Update task status in registry
        if (message.content && message.content.taskId) {
          const { taskId, status } = message.content;
          console.log(`Handling task status update: ${taskId} status: ${status}`);
          this.tasks.updateTaskStatus(taskId, status, message.content);
          // Emit event for status update
          this.eventBus.emit('task.status', message);
        }
        return;

      case 'task.notification':
        this.eventBus.emit('task.notification', message);
        return;

      case 'service.task.result':
        this.eventBus.emit('service.task.result', message);
        return;

      case 'service.notification':
        this.eventBus.emit('service.notification', message);
        return;

      case 'agent.status.update':
        // Get agent by connection ID
        const statusUpdateAgent = this.agents.getAgentByConnectionId(connectionId);
        if (!statusUpdateAgent) {
          return {
            type: 'error',
            content: { error: 'Agent not registered' }
          };
        }

        // Update agent status
        const { status, message: statusMessage } = message.content;
        if (!status) {
          return {
            type: 'error',
            content: { error: 'Status is required for status update' }
          };
        }

        this.agents.updateAgentStatus(statusUpdateAgent.id, status, {
          message: statusMessage,
          updatedAt: new Date().toISOString()
        });

        return {
          type: 'agent.status.updated',
          content: {
            agentId: statusUpdateAgent.id,
            status,
            message: `Agent status updated to ${status}`
          }
        };

      case 'agent.list.request':
        // Get agent by connection ID for attribution
        const requestingAgent = this.agents.getAgentByConnectionId(connectionId);
        if (!requestingAgent) {
          return {
            type: 'error',
            content: { error: 'Agent not registered' }
          };
        }

        try {
          const filters = message.content?.filters || {};
          const agents = this.getAgentList(filters);
          return {
            type: 'agent.list.response',
            content: { agents }
          };
        } catch (error) {
          return {
            type: 'error',
            content: { error: error instanceof Error ? error.message : String(error) }
          };
        }

      case 'mcp.servers.list':
        try {
          const agent = this.agents.getAgentByConnectionId(connectionId);
          if (!agent) {
            return {
              type: 'error',
              content: { error: 'Agent not registered' }
            };
          }

          const servers = this.handleMCPServersListRequest(agent);
          return {
            type: 'mcp.servers.list',
            content: servers
          };
        } catch (error) {
          return {
            type: 'error',
            content: { error: error instanceof Error ? error.message : String(error) }
          };
        }

      case 'mcp.tools.list':
        try {
          const agent = this.agents.getAgentByConnectionId(connectionId);
          if (!agent) {
            return {
              type: 'error',
              content: { error: 'Agent not registered' }
            };
          }

          const { serverId } = message.content || {};
          if (!serverId) {
            return {
              type: 'error',
              content: { error: 'Server ID is required' }
            };
          }

          const tools = this.handleMCPToolsListRequest(serverId, agent);
          return {
            type: 'mcp.tools.list',
            content: tools
          };
        } catch (error) {
          return {
            type: 'error',
            content: { error: error instanceof Error ? error.message : String(error) }
          };
        }

      case 'mcp.tool.execute':
        try {
          const agent = this.agents.getAgentByConnectionId(connectionId);
          if (!agent) {
            return {
              type: 'error',
              content: { error: 'Agent not registered' }
            };
          }

          const { serverId, toolName, parameters } = message.content || {};
          if (!serverId || !toolName) {
            return {
              type: 'error',
              content: { error: 'Server ID and tool name are required' }
            };
          }

          const result = this.handleMCPToolExecuteRequest(serverId, toolName, parameters || {}, agent);
          return {
            type: 'mcp.tool.execution.result',
            content: result
          };
        } catch (error) {
          return {
            type: 'error',
            content: { error: error instanceof Error ? error.message : String(error) }
          };
        }

      default:
        throw new Error(`Unsupported message type: ${type}`);
    }
  }

  /**
   * Handle service registration
   * @param message Registration message
   * @param connectionId Connection ID
   * @returns Registration response
   */
  handleServiceRegistration(message: any, connectionId: string): any {
    const { content } = message;
    const { name, capabilities = [], manifest = {} } = content;

    if (!name) {
      throw new Error('Service registration missing required field: name');
    }

    const now = new Date().toISOString();

    // Register the service
    const service = this.services.registerService({
      id: uuidv4(),
      name,
      capabilities,
      manifest,
      connectionId,
      status: 'online',
      registeredAt: now
    } as Service);

    return {
      type: 'service.registered',
      content: {
        serviceId: service.id,
        name: service.name,
        capabilities: service.capabilities,
        manifest: service.manifest
      }
    };
  }

  /**
   * Handle service list request
   * @param filters Optional filters for the service list
   * @param requestId Optional request ID for tracking the response
   */
  handleServiceListRequest(filters: any, requestId?: string): void {
    try {
      // Get all services matching the filters
      const serviceList = this.services.getAllServices(filters).map(service => ({
        id: service.id,
        name: service.name,
        status: service.status,
        capabilities: service.capabilities
      }));
      
      // Emit result event with the request ID
      this.eventBus.emit(`client.service.list.result.${requestId || 'default'}`, serviceList);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.service.list.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle client agent list request
   * @param filters Optional filters for the agent list
   * @param requestId Optional request ID for tracking the response
   */
  handleClientAgentListRequest(filters: any, requestId?: string): void {
    try {
      const agentList = this.getAgentList(filters);
      // Emit result event with the request ID
      this.eventBus.emit(`client.agent.list.result.${requestId || 'default'}`, agentList);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.agent.list.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle client task create request
   * @param message The task creation message
   * @param clientId The client ID
   * @param requestId Optional request ID for tracking the response
   */
  async handleClientTaskCreateRequest(message: BaseMessage, clientId: string, requestId?: string): Promise<void> {
    try {
      const result = await this.handleTaskCreation(message, clientId);
      // Emit result event with the request ID
      this.eventBus.emit(`client.task.create.result.${requestId || 'default'}`, result);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.task.create.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle client task status request
   * @param taskId The task ID to get status for
   * @param requestId Optional request ID for tracking the response
   */
  handleClientTaskStatusRequest(taskId: string, requestId?: string): void {
    try {
      const taskStatus = this.getTaskStatus(taskId);
      // Emit result event with the request ID
      this.eventBus.emit(`client.task.status.result.${requestId || 'default'}`, taskStatus);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.task.status.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle client MCP server list request
   * @param filters Optional filters for the MCP server list
   * @param requestId Optional request ID for tracking the response
   */
  handleClientMCPServerListRequest(filters: any, requestId?: string): void {
    try {
      const servers = this.mcp.getServerList(filters);
      // Emit result event with the request ID
      this.eventBus.emit(`client.mcp.server.list.result.${requestId || 'default'}`, servers);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.mcp.server.list.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle client MCP server tools request
   * @param serverId The MCP server ID
   * @param requestId Optional request ID for tracking the response
   */
  async handleClientMCPServerToolsRequest(serverId: string, requestId?: string): Promise<void> {
    try {
      const tools = await this.mcp.getToolList(serverId);
      // Emit result event with the request ID
      this.eventBus.emit(`client.mcp.server.tools.result.${requestId || 'default'}`, tools);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.mcp.server.tools.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle client MCP tool execute request
   * @param params The tool execution parameters
   * @param requestId Optional request ID for tracking the response
   */
  async handleClientMCPToolExecuteRequest(params: any, requestId?: string): Promise<void> {
    try {
      const result = await this.mcp.executeServerTool(
        params.serverId, 
        params.toolName, 
        params.parameters || {}
      );
      
      // Emit result event with the request ID
      this.eventBus.emit(`client.mcp.tool.execute.result.${requestId || 'default'}`, {
        serverId: params.serverId,
        toolName: params.toolName,
        result,
        status: 'success'
      });
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`client.mcp.tool.execute.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle service registration event
   * @param message The service registration message
   * @param connectionId The service connection ID
   * @param requestId Optional request ID for tracking the response
   */
  handleServiceRegisterEvent(message: any, connectionId: string, requestId?: string): void {
    try {
      const result = this.handleServiceRegistration(message, connectionId);
      // Emit result event with the request ID
      this.eventBus.emit(`service.register.result.${requestId || 'default'}`, result);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`service.register.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle service status update event
   * @param message The service status update message
   * @param connectionId The service connection ID
   * @param requestId Optional request ID for tracking the response
   */
  handleServiceStatusUpdateEvent(message: any, connectionId: string, requestId?: string): void {
    try {
      // Get the service by connection ID
      const service = this.services.getServiceByConnectionId(connectionId);
      if (!service) {
        throw new Error('Service not registered');
      }
      
      // Update service status
      const { status, message: statusMessage } = message.content;
      this.services.updateServiceStatus(service.id, status, {
        message: statusMessage,
        updatedAt: new Date().toISOString()
      });
      
      // Prepare response
      const result = {
        serviceId: service.id,
        status,
        message: `Service status updated to ${status}`
      };
      
      // Emit result event with the request ID
      this.eventBus.emit(`service.status.update.result.${requestId || 'default'}`, result);
    } catch (error) {
      // Emit error event with the request ID
      this.eventBus.emit(`service.status.update.error.${requestId || 'default'}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

export default MessageHandler; 