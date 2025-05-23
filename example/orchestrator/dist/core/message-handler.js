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
        this.clients = config.clients;
        this.eventBus = config.eventBus;
        this.mcp = config.mcp;
    }
    /**
     * Handle client registered event
     * @param client The client that was registered
     */
    handleClientRegistered(client) {
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
    handleClientListRequest(filters, requestId) {
        try {
            const clientList = this.getClientList(filters);
            // Emit result event with the request ID
            this.eventBus.emit(`client.list.result.${requestId || 'default'}`, clientList);
        }
        catch (error) {
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
    handleAgentListRequest(filters, requestId) {
        try {
            const agentList = this.getAgentList(filters);
            // Emit result event with the request ID
            this.eventBus.emit(`agent.list.result.${requestId || 'default'}`, agentList);
        }
        catch (error) {
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
    getClientList(filters = {}) {
        if (!this.clients)
            return [];
        return this.clients.getAllClients({
            status: filters.status
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
    handleClientDisconnected(connectionId) {
        if (!this.clients)
            return;
        const client = this.clients.handleDisconnection(connectionId);
        if (client) {
            console.log(`Client disconnected: ${client.id}${client.name ? ` (${client.name})` : ''}`);
            // Emit event for client disconnection
            this.eventBus.emit('client.disconnected', client);
        }
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
     * Handle service task execute request messages
     * @param {AgentMessages.ServiceRequestMessage | ServiceMessages.ServiceTaskExecuteMessage} message - The service request message
     * @param {string} connectionId - Agent connection ID
     * @returns {Object} Service result
     */
    async handleServiceTaskExecuteRequest(message, connectionId) {
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
     * Handle service task execute event
     * @param message The service task message
     * @param connectionId The connection ID
     * @param requestId The request ID for tracking the response
     */
    async handleServiceTaskExecuteEvent(message, connectionId, requestId) {
        try {
            // Execute the service task and get the result
            const result = await this.handleServiceTaskExecuteRequest(message, connectionId);
            // Emit the result event with the request ID
            this.eventBus.emit(`service.task.execute.result.${requestId || 'default'}`, result);
        }
        catch (error) {
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
    async handleMCPRequest(params, agent) {
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
                return this.handleMCPToolExecuteRequest(serverId, toolName, toolArgs || parameters || {}, agent);
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
        const servers = this.mcp.listMCPServers();
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
    async handleMCPToolsListRequest(serverId, agent) {
        const tools = await this.mcp.getToolList(serverId);
        const servers = this.mcp.listMCPServers();
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
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Handle client agent list request
     * @param filters Optional filters for the agent list
     * @param requestId Optional request ID for tracking the response
     */
    handleClientAgentListRequest(filters, requestId) {
        try {
            const agentList = this.getAgentList(filters);
            // Emit result event with the request ID
            this.eventBus.emit(`client.agent.list.result.${requestId || 'default'}`, agentList);
        }
        catch (error) {
            // Emit error event with the request ID
            this.eventBus.emit(`client.agent.list.error.${requestId || 'default'}`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Handle client task status request
     * @param taskId The task ID to get status for
     * @param requestId Optional request ID for tracking the response
     */
    handleClientTaskStatusRequest(taskId, requestId) {
        try {
            const taskStatus = this.getTaskStatus(taskId);
            // Emit result event with the request ID
            this.eventBus.emit(`client.task.status.result.${requestId || 'default'}`, taskStatus);
        }
        catch (error) {
            // Emit error event with the request ID
            this.eventBus.emit(`client.task.status.error.${requestId || 'default'}`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Handle client MCP server tools request
     * @param serverId The MCP server ID
     * @param requestId Optional request ID for tracking the response
     */
    async handleClientMCPServerToolsRequest(serverId, requestId) {
        try {
            const tools = await this.mcp.getToolList(serverId);
            // Emit result event with the request ID
            this.eventBus.emit(`client.mcp.server.tools.result.${requestId || 'default'}`, tools);
        }
        catch (error) {
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
    async handleClientMCPToolExecuteRequest(params, requestId) {
        try {
            const result = await this.mcp.executeServerTool(params.serverId, params.toolName, params.parameters || {});
            // Emit result event with the request ID
            this.eventBus.emit(`client.mcp.tool.execute.result.${requestId || 'default'}`, {
                serverId: params.serverId,
                toolName: params.toolName,
                result,
                status: 'success'
            });
        }
        catch (error) {
            // Emit error event with the request ID
            this.eventBus.emit(`client.mcp.tool.execute.error.${requestId || 'default'}`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
exports.default = MessageHandler;
