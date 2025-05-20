"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
/**
 * MessageHandler - Centralizes business logic for handling messages in ASP
 * Processes messages from clients and agents, coordinates tasks and services
 */
class MessageHandler {
    constructor(config) {
        this.agents = config.agents;
        this.tasks = config.tasks;
        this.services = config.services;
        this.serviceTasks = config.serviceTasks;
        this.eventBus = config.eventBus;
        this.mcp = config.mcp;
    }
    /**
     * Handle a client task creation request
     * @param {BaseMessage} message - The task creation message
     * @param {string} clientId - The client's connection ID
     * @returns {Object} Task creation result
     */
    async handleTaskCreation(message, clientId) {
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
        let agent;
        if (agentId) {
            // Find agent directly by ID
            agent = this.agents.getAgentById(agentId);
            if (!agent) {
                throw new Error(`Agent not found: No agent found with ID '${agentId}'`);
            }
        }
        else if (agentName) {
            // Find the agent by name
            agent = this.agents.getAgentByName(agentName);
            if (!agent) {
                throw new Error(`Agent not found: No agent found with name '${agentName}'`);
            }
        }
        else {
            throw new Error('Invalid task creation request: Either agentName or agentId is required');
        }
        // Create a task
        const taskId = (0, uuid_1.v4)();
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
        try {
            const task = this.tasks.getTask(taskId);
            return {
                taskId,
                status: task.status,
                result: task.result,
                createdAt: task.createdAt,
                completedAt: task.completedAt
            };
        }
        catch (error) {
            throw new Error(`Task not found: ${error instanceof Error ? error.message : String(error)}`);
        }
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
     * @param {BaseMessage} message - Registration message
     * @param {string} connectionId - Agent connection ID
     * @param {any} ws - WebSocket connection object
     * @returns {Object} Registration result
     */
    handleAgentRegistration(message, connectionId, ws) {
        const { name, capabilities, manifest } = message.content;
        if (!name) {
            throw new Error('Agent name is required');
        }
        // Check if there's a pre-configured agent with this name
        const agentConfig = this.agents.getAgentConfigurationByName(name);
        // Register the agent
        const agent = {
            id: agentConfig ? agentConfig.id : (0, uuid_1.v4)(),
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
        // Store the WebSocket connection if provided
        if (ws) {
            agent.connection = ws;
        }
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
     * Handle service request messages
     * @param {AgentMessages.ServiceRequestMessage | ServiceMessages.ServiceTaskExecuteMessage} message - The service request message
     * @param {string} connectionId - Agent connection ID
     * @returns {Object} Service result
     */
    async handleServiceRequest(message, connectionId) {
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
            return this.handleMCPRequest(params, agent);
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
        const taskId = (0, uuid_1.v4)();
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
            const resultHandler = (completedTaskId, result) => {
                if (completedTaskId === taskId) {
                    clearTimeout(timeoutId);
                    this.eventBus.removeListener('service.task.completed', resultHandler);
                    this.eventBus.removeListener('service.task.failed', errorHandler);
                    resolve(result);
                }
            };
            const errorHandler = (failedTaskId, error) => {
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
     * Handle MCP service request
     * @param params - MCP request parameters
     * @param agent - Requesting agent
     * @returns MCP service result
     */
    async handleMCPRequest(params, agent) {
        const { action, mcpServerName, toolName, toolArgs, serverId } = params;
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
                return this.handleMCPToolExecuteRequest(serverId, toolName, toolArgs || {}, agent);
            default:
                throw new Error(`Invalid MCP action: ${action}`);
        }
    }
    /**
     * Handle request for list of MCP servers
     * @param agent - The requesting agent
     * @returns List of MCP servers
     */
    async handleMCPServersListRequest(agent) {
        const servers = this.mcp.getServerList();
        return {
            servers
        };
    }
    /**
     * Handle request for list of MCP tools on a server
     * @param serverId - The ID of the server
     * @param agent - The requesting agent
     * @returns List of MCP tools
     */
    async handleMCPToolsListRequest(serverId, agent) {
        const tools = this.mcp.getToolList(serverId);
        return {
            serverId,
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
    async handleMCPToolExecuteRequest(serverId, toolName, args, agent) {
        try {
            const result = await this.mcp.executeServerTool(serverId, toolName, args);
            return {
                serverId,
                toolName,
                status: 'success',
                result
            };
        }
        catch (error) {
            return {
                serverId,
                toolName,
                status: 'error',
                error: error.message
            };
        }
    }
    /**
     * Handle service disconnection
     * @param connectionId - ID of the disconnected service
     */
    handleServiceDisconnected(connectionId) {
        const service = this.services.getServiceByConnectionId(connectionId);
        if (service) {
            console.log(`Service disconnected: ${service.name}`);
            this.services.updateServiceStatus(service.id, 'offline', { disconnectedAt: new Date().toISOString() });
        }
    }
    /**
     * Handle agent disconnection
     * @param connectionId - ID of the disconnected agent
     */
    handleAgentDisconnected(connectionId) {
        const agent = this.agents.getAgentByConnectionId(connectionId);
        if (agent) {
            console.log(`Agent disconnected: ${agent.name}`);
            // Remove the connection object
            agent.connection = undefined;
            // Update agent status to offline
            this.agents.updateAgentStatus(agent.id, 'offline', { disconnectedAt: new Date().toISOString() });
        }
    }
    /**
     * Handle an incoming message
     * @param message The message to handle
     * @param connectionId ID of the connection that sent the message
     * @returns Response message if needed
     */
    handleMessage(message, connectionId) {
        const { type } = message;
        switch (type) {
            case 'agent.register':
                return this.handleAgentRegistration(message, connectionId);
            case 'service.register':
                return this.handleServiceRegistration(message, connectionId);
            case 'service.request':
            case 'service.task.execute':
                return this.handleServiceRequest(message, connectionId);
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
                }
                catch (error) {
                    return {
                        type: 'error',
                        content: { error: error instanceof Error ? error.message : String(error) }
                    };
                }
            case 'mcp.servers.list.request':
                try {
                    const agent = this.agents.getAgentByConnectionId(connectionId);
                    if (!agent) {
                        return {
                            type: 'error',
                            content: { error: 'Agent not registered' }
                        };
                    }
                    const result = this.handleMCPServersListRequest(agent);
                    return {
                        type: 'mcp.servers.list',
                        content: result
                    };
                }
                catch (error) {
                    return {
                        type: 'error',
                        content: { error: error instanceof Error ? error.message : String(error) }
                    };
                }
            case 'mcp.tools.list.request':
                try {
                    const agent = this.agents.getAgentByConnectionId(connectionId);
                    if (!agent) {
                        return {
                            type: 'error',
                            content: { error: 'Agent not registered' }
                        };
                    }
                    const serverId = message.content?.serverId;
                    if (!serverId) {
                        return {
                            type: 'error',
                            content: { error: 'Server ID is required' }
                        };
                    }
                    const result = this.handleMCPToolsListRequest(serverId, agent);
                    return {
                        type: 'mcp.tools.list',
                        content: result
                    };
                }
                catch (error) {
                    return {
                        type: 'error',
                        content: { error: error instanceof Error ? error.message : String(error) }
                    };
                }
            case 'mcp.tool.execute.request':
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
                }
                catch (error) {
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
    handleServiceRegistration(message, connectionId) {
        const { content } = message;
        const { name, capabilities = [], manifest = {} } = content;
        if (!name) {
            throw new Error('Service registration missing required field: name');
        }
        const now = new Date().toISOString();
        // Register the service
        const service = this.services.registerService({
            id: (0, uuid_1.v4)(),
            name,
            capabilities,
            manifest,
            connectionId,
            status: 'online',
            registeredAt: now
        });
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
}
exports.default = MessageHandler;
