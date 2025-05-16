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
     * @param {any} ws - The WebSocket connection
     * @returns {Object} Registration result
     */
    handleAgentRegistration(message, ws) {
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
            connectionId: ws.id,
            status: 'online',
            registeredAt: new Date().toISOString(),
            // Set the WebSocket connection directly
            ...(ws ? { connection: ws } : {})
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
     * @param message - Service request message
     * @param connectionId - Requesting agent's connection ID
     * @returns Service result
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
        const serviceObj = this.services.getServiceByName(service);
        if (!serviceObj) {
            throw new Error(`Service not found: ${service}`);
        }
        // Check if the agent is allowed to use this service
        if (agent.manifest?.requiredServices && !agent.manifest.requiredServices.includes(service)) {
            throw new Error(`Agent is not authorized to use service: ${service}`);
        }
        // Create a service task
        const taskId = (0, uuid_1.v4)();
        // Emit event for service task creation
        this.eventBus.emit('service.task.created', taskId, serviceObj.id, agent.id, null, {
            functionName: params?.functionName || 'default',
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
            case 'task.result':
                this.eventBus.emit('task.result', message);
                return;
            case 'task.status':
                // Update task status in registry
                if (message.content && message.content.taskId) {
                    const { taskId, status } = message.content;
                    this.tasks.updateTaskStatus(taskId, status);
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
            default:
                console.warn(`Unhandled message type: ${type}`);
                return;
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
