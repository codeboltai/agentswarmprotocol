"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const uuid_1 = require("uuid");
const events_1 = require("events");
const agent_registry_1 = require("../registry/agent-registry");
const agent_task_registry_1 = require("./utils/tasks/agent-task-registry");
const service_registry_1 = require("../registry/service-registry");
const client_registry_1 = require("../registry/client-registry");
const service_task_registry_1 = require("./utils/tasks/service-task-registry");
const agent_server_1 = __importDefault(require("../agent/agent-server"));
const client_server_1 = __importDefault(require("../client/client-server"));
const service_server_1 = __importDefault(require("../service/service-server"));
const message_handler_1 = __importDefault(require("./message-handler"));
const mcp = __importStar(require("./utils/mcp"));
const config_loader_1 = __importDefault(require("./utils/config-loader"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config({ path: '../.env' });
/**
 * Orchestrator - Main coordinator for the Agent Swarm Protocol
 * Manages communication between agents and clients through dedicated servers
 */
class Orchestrator {
    constructor(config = {}) {
        // Create config loader and get resolved config
        this.configLoader = new config_loader_1.default({
            configPath: config.configPath
        });
        // Get the fully resolved configuration
        const resolvedConfig = this.configLoader.getResolvedConfig(config);
        // Set instance properties from resolved config
        this.port = resolvedConfig.port;
        this.clientPort = resolvedConfig.clientPort;
        this.servicePort = resolvedConfig.servicePort;
        this.logLevel = resolvedConfig.logLevel;
        this.agents = new agent_registry_1.AgentRegistry();
        this.tasks = new agent_task_registry_1.AgentTaskRegistry();
        this.services = new service_registry_1.ServiceRegistry();
        this.clients = new client_registry_1.ClientRegistry();
        this.serviceTasks = new service_task_registry_1.ServiceTaskRegistry();
        this.pendingResponses = {}; // Track pending responses
        // Create event bus for communication between components
        this.eventBus = new events_1.EventEmitter();
        // Set up MCP support
        this.mcpAdapter = mcp.setup(this.eventBus);
        // Create message handler to centralize business logic
        this.messageHandler = new message_handler_1.default({
            agents: this.agents,
            tasks: this.tasks,
            services: this.services,
            serviceTasks: this.serviceTasks,
            clients: this.clients,
            eventBus: this.eventBus,
            mcp: this.mcpAdapter
        });
        // Create servers with specific dependencies rather than passing the entire orchestrator
        this.agentServer = new agent_server_1.default({ agents: this.agents }, this.eventBus, { port: this.port }, this.messageHandler);
        this.clientServer = new client_server_1.default(this.eventBus, {
            clientPort: this.clientPort,
            clientRegistry: this.clients
        });
        this.serviceServer = new service_server_1.default({ services: this.services }, this.eventBus, { port: this.servicePort });
        // Set up event listeners
        this.setupEventListeners();
    }
    //OK
    setupEventListeners() {
        // IMPORTANT NOTE: When adding or modifying event handlers, ensure:
        // 1. Event names are unique and specific
        // 2. Parameter counts match between emitter and listener
        // 3. All emitters include proper error handling
        // Message Handler event listeners - moved from message-handler.ts
        // Listen for agent registration events
        this.eventBus.on('agent.registered', (agentId, connectionId) => {
            this.messageHandler.handleAgentRegistered(agentId, connectionId);
        });
        // Listen for client registration events
        this.eventBus.on('client.registered', (client) => {
            this.messageHandler.handleClientRegistered(client);
        });
        // Listen for client list requests
        this.eventBus.on('client.list.request', (filters, requestId) => {
            this.messageHandler.handleClientListRequest(filters, requestId);
        });
        // Listen for agent list requests
        this.eventBus.on('agent.list.request', (filters, requestId) => {
            this.messageHandler.handleAgentListRequest(filters, requestId);
        });
        // Listen for service list requests
        this.eventBus.on('client.service.list', (filters, requestId) => {
            this.messageHandler.handleServiceListRequest(filters, requestId);
        });
        // Listen for service task execution requests
        this.eventBus.on('service.task.execute', (message, connectionId, requestId) => {
            this.messageHandler.handleServiceTaskExecuteEvent(message, connectionId, requestId);
        });
        // Listen for client agent list requests
        this.eventBus.on('client.agent.list', (message, clientId, clientServer) => {
            const filters = message?.content?.filters || {};
            this.messageHandler.handleClientAgentListRequest(filters, message?.id);
        });
        // Listen for client task creation requests
        this.eventBus.on('client.task.create', (message, clientId, requestId) => {
            this.messageHandler.handleClientTaskCreateRequest(message, clientId, requestId);
        });
        // Listen for client task status requests
        this.eventBus.on('client.task.status', (message, clientId, clientServer) => {
            const taskId = message?.content?.taskId;
            if (taskId) {
                this.messageHandler.handleClientTaskStatusRequest(taskId, message?.id);
            }
        });
        // Listen for client MCP server list requests
        this.eventBus.on('client.mcp.server.list', (filters, requestId) => {
            this.messageHandler.handleClientMCPServerListRequest(filters, requestId);
        });
        // Listen for client MCP server tools requests
        this.eventBus.on('client.mcp.server.tools', (serverId, requestId) => {
            this.messageHandler.handleClientMCPServerToolsRequest(serverId, requestId);
        });
        // Listen for client MCP tool execution requests
        this.eventBus.on('client.mcp.tool.execute', (params, requestId) => {
            this.messageHandler.handleClientMCPToolExecuteRequest(params, requestId);
        });
        // NEW: Handle task.message events from client SDK
        this.eventBus.on('task.message', (message, clientId) => {
            try {
                const { taskId, messageType, message: taskMessage } = message.content;
                if (!taskId) {
                    this.clientServer.sendError(clientId, 'Task ID is required for task message', message.id);
                    return;
                }
                // Get the task to find the agent
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    this.clientServer.sendError(clientId, `Task ${taskId} not found`, message.id);
                    return;
                }
                // Get the agent connection
                const agent = this.agents.getAgentById(task.agentId);
                if (!agent || !agent.connectionId) {
                    this.clientServer.sendError(clientId, `Agent for task ${taskId} not connected`, message.id);
                    return;
                }
                // Forward the message to the agent
                this.agentServer.send(agent.connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'task.messageresponse',
                    content: {
                        taskId,
                        messageType: messageType || 'client.message',
                        message: taskMessage,
                        clientId
                    }
                });
                // Send confirmation to client
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'task.message.sent',
                    content: {
                        taskId,
                        status: 'sent'
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error sending task message', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // NEW: Handle agent task request messages (agent-to-agent communication)
        this.eventBus.on('agent.task.request', (message, connectionId) => {
            try {
                const { targetAgentName, taskType, taskData, timeout } = message.content;
                if (!targetAgentName || !taskData) {
                    this.agentServer.sendError(connectionId, 'Target agent name and task data are required', message.id);
                    return;
                }
                // Find the target agent
                const targetAgent = this.agents.getAgentByName(targetAgentName);
                if (!targetAgent) {
                    this.agentServer.sendError(connectionId, `Agent ${targetAgentName} not found`, message.id);
                    return;
                }
                // Get the requesting agent
                const requestingAgent = this.agents.getAgentByConnectionId(connectionId);
                if (!requestingAgent) {
                    this.agentServer.sendError(connectionId, 'Requesting agent not found', message.id);
                    return;
                }
                // Create a child task
                const childTaskId = (0, uuid_1.v4)();
                // Register the child task
                this.tasks.registerTask(childTaskId, {
                    type: 'agent.child.task',
                    name: `Child task from ${requestingAgent.name}`,
                    severity: 'normal',
                    agentId: targetAgent.id,
                    parentTaskId: message.content.parentTaskId,
                    requestingAgentId: requestingAgent.id,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData: {
                        taskType,
                        ...taskData,
                        metadata: {
                            requestingAgent: {
                                id: requestingAgent.id,
                                name: requestingAgent.name
                            },
                            timeout: timeout || 30000
                        }
                    }
                });
                // Send acceptance response to requesting agent
                this.agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'childagent.request.accepted',
                    content: {
                        childTaskId,
                        targetAgent: targetAgentName,
                        status: 'accepted'
                    },
                    requestId: message.id
                });
                // Emit task created event to send to target agent
                this.eventBus.emit('task.created', childTaskId, targetAgent.id, requestingAgent.id, {
                    taskType,
                    ...taskData,
                    metadata: {
                        requestingAgent: {
                            id: requestingAgent.id,
                            name: requestingAgent.name
                        }
                    }
                });
            }
            catch (error) {
                this.agentServer.sendError(connectionId, `Error processing agent task request: ${error instanceof Error ? error.message : String(error)}`, message.id);
            }
        });
        // NEW: Handle service tools list requests from agents
        this.eventBus.on('service.tools.list', (message, connectionId) => {
            try {
                const { serviceId } = message.content;
                if (!serviceId) {
                    this.agentServer.sendError(connectionId, 'Service ID is required', message.id);
                    return;
                }
                // Get the service
                const service = this.services.getServiceById(serviceId);
                if (!service) {
                    this.agentServer.sendError(connectionId, `Service ${serviceId} not found`, message.id);
                    return;
                }
                // For now, return empty tools list - services should implement their own tool discovery
                // This can be enhanced later when services register their available tools
                this.agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.tools.list.response',
                    content: {
                        serviceId,
                        tools: [] // Services can register their tools in the future
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.agentServer.sendError(connectionId, `Error getting service tools: ${error instanceof Error ? error.message : String(error)}`, message.id);
            }
        });
        // NEW: Enhanced service task execution with client notifications
        this.eventBus.on('service.task.execute', (message, connectionId) => {
            try {
                const { serviceId, toolName, params, clientId } = message.content;
                if (!serviceId || !toolName) {
                    this.agentServer.sendError(connectionId, 'Service ID and tool name are required', message.id);
                    return;
                }
                // Get the service
                const service = this.services.getServiceById(serviceId);
                if (!service || !service.connectionId) {
                    this.agentServer.sendError(connectionId, `Service ${serviceId} not found or not connected`, message.id);
                    return;
                }
                // Get the requesting agent
                const requestingAgent = this.agents.getAgentByConnectionId(connectionId);
                // Create a service task
                const serviceTaskId = (0, uuid_1.v4)();
                // Register the service task
                this.serviceTasks.registerTask(serviceTaskId, {
                    type: 'service.task',
                    name: `Service task: ${toolName}`,
                    severity: 'normal',
                    serviceId: service.id,
                    agentId: requestingAgent?.id,
                    clientId: clientId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData: {
                        functionName: toolName,
                        params: params || {},
                        metadata: {
                            agentId: requestingAgent?.id,
                            clientId: clientId,
                            timestamp: new Date().toISOString()
                        }
                    }
                });
                // Send service started notification to client if clientId is provided
                if (clientId && this.clientServer.hasClientConnection(clientId)) {
                    this.clientServer.send(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'service.started',
                        content: {
                            serviceTaskId,
                            serviceId,
                            serviceName: service.name,
                            toolName,
                            agentId: requestingAgent?.id,
                            agentName: requestingAgent?.name,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                // Send the task to the service
                this.serviceServer.send(service.connectionId, {
                    id: serviceTaskId,
                    type: 'service.task.execute',
                    content: {
                        functionName: toolName,
                        params: params || {},
                        metadata: {
                            agentId: requestingAgent?.id,
                            clientId: clientId,
                            timestamp: new Date().toISOString()
                        }
                    }
                });
                // Send acceptance response to agent
                this.agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.request.accepted',
                    content: {
                        serviceTaskId,
                        serviceId,
                        serviceName: service.name,
                        status: 'accepted'
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.agentServer.sendError(connectionId, `Error executing service task: ${error instanceof Error ? error.message : String(error)}`, message.id);
            }
        });
        // Listen for service registration events
        this.eventBus.on('service.register', (message, connectionId, serviceServer) => {
            try {
                const content = message.content || {};
                if (!content.name) {
                    return this.serviceServer.sendError(connectionId, 'Service name is required', message.id);
                }
                // Register the service
                const serviceId = content.id || (0, uuid_1.v4)();
                const service = {
                    id: serviceId,
                    name: content.name,
                    type: content.type || 'service',
                    capabilities: content.capabilities || [],
                    status: 'online',
                    connectionId, // Include the connectionId in the service object
                    registeredAt: new Date().toISOString(),
                    metadata: content.metadata || {}
                };
                // Register in registry - passing only the service object
                this.services.registerService(service);
                // Respond with confirmation
                this.serviceServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.registered',
                    content: {
                        id: serviceId,
                        name: service.name,
                        status: service.status,
                        message: 'Service successfully registered'
                    },
                    requestId: message.id
                });
                console.log(`Service ${service.name} (${serviceId}) registered successfully`);
            }
            catch (error) {
                this.serviceServer.sendError(connectionId, 'Error registering service', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        this.eventBus.on('service.status.update', (message, connectionId, serviceServer) => {
            try {
                const content = message.content || {};
                const { status } = content;
                if (!status) {
                    return this.serviceServer.sendError(connectionId, 'Status is required', message.id);
                }
                // Get service ID from connection
                const service = this.services.getServiceByConnectionId(connectionId);
                if (!service) {
                    return this.serviceServer.sendError(connectionId, 'Service not found or not registered', message.id);
                }
                // Update service status
                this.services.updateServiceStatus(service.id, status, content);
                // Respond with confirmation
                this.serviceServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.status.updated',
                    content: {
                        id: service.id,
                        status,
                        message: 'Service status updated successfully'
                    },
                    requestId: message.id
                });
                console.log(`Service ${service.name} (${service.id}) status updated to ${status}`);
            }
            catch (error) {
                this.serviceServer.sendError(connectionId, 'Error updating service status', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        this.eventBus.on('service.task.notification', (message, connectionId, serviceServer) => {
            try {
                // Get service info
                const serviceId = this.services.getServiceByConnectionId(connectionId)?.id;
                if (!serviceId) {
                    return this.serviceServer.sendError(connectionId, 'Service not registered or unknown', message.id);
                }
                const service = this.services.getServiceById(serviceId);
                if (!service) {
                    return this.serviceServer.sendError(connectionId, 'Service not found', message.id);
                }
                // Enhance the notification with service information
                const enhancedNotification = {
                    ...message,
                    content: {
                        ...message.content,
                        serviceId: service.id,
                        serviceName: service.name
                    }
                };
                // Process the notification internally
                console.log(`Processing service notification from ${service.name} (${serviceId})`);
                // Forward the notification to clients if needed based on metadata
                if (enhancedNotification.content.metadata && enhancedNotification.content.metadata.clientId) {
                    const { clientId } = enhancedNotification.content.metadata;
                    if (clientId && this.clientServer.hasClientConnection(clientId)) {
                        this.clientServer.forwardServiceNotificationToClient(clientId, enhancedNotification.content);
                    }
                }
                // Send confirmation
                this.serviceServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'notification.received',
                    content: {
                        message: 'Notification received',
                        notificationId: message.id
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.serviceServer.sendError(connectionId, 'Error processing notification', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Listen for client disconnection events
        this.eventBus.on('client.disconnected', (connectionId) => {
            this.messageHandler.handleClientDisconnected(connectionId);
        });
        // MCP-related event listeners
        // Listen for MCP server registration
        this.eventBus.on('mcp.server.register', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.registerMCPServer(message);
                this.eventBus.emit('mcp.server.register.result', result, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.server.register.error', { error: error.message }, requestId);
            }
        });
        // Listen for MCP server connection
        this.eventBus.on('mcp.server.connect', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.connectToMCPServer(message.serverId);
                this.eventBus.emit('mcp.server.connect.result', result, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.server.connect.error', { error: error.message }, requestId);
            }
        });
        // Listen for MCP server disconnection
        this.eventBus.on('mcp.server.disconnect', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.disconnectMCPServer(message.serverId);
                this.eventBus.emit('mcp.server.disconnect.result', result, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.server.disconnect.error', { error: error.message }, requestId);
            }
        });
        // Listen for MCP tool execution requests
        this.eventBus.on('mcp.tool.execute', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.executeMCPTool(message.serverId, message.toolName, message.toolArgs || message.parameters || {});
                this.eventBus.emit('mcp.tool.execute.result', {
                    serverId: message.serverId,
                    toolName: message.toolName,
                    result,
                    status: 'success'
                }, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.tool.execute.error', {
                    serverId: message.serverId,
                    toolName: message.toolName,
                    status: 'error',
                    error: error.message
                }, requestId);
            }
        });
        // Listen for MCP server list requests
        this.eventBus.on('mcp.server.list', (message, requestId) => {
            try {
                const result = this.mcpAdapter.listMCPServers(message.filters);
                this.eventBus.emit('mcp.server.list.result', { servers: result }, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.server.list.error', { error: error.message }, requestId);
            }
        });
        // Also listen for SDK-style 'mcp.servers.list' for compatibility
        this.eventBus.on('mcp.servers.list', (message, requestId) => {
            try {
                const result = this.mcpAdapter.listMCPServers(message.filters);
                this.eventBus.emit('mcp.server.list.result', { servers: result }, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.server.list.error', { error: error.message }, requestId);
            }
        });
        // Listen for MCP tool list requests
        this.eventBus.on('mcp.tool.list', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.listMCPTools(message.serverId);
                this.eventBus.emit('mcp.tool.list.result', {
                    serverId: message.serverId,
                    tools: result
                }, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.tool.list.error', { error: error.message }, requestId);
            }
        });
        // Also listen for SDK-style 'mcp.tools.list' for compatibility
        this.eventBus.on('mcp.tools.list', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.listMCPTools(message.serverId);
                this.eventBus.emit('mcp.tool.list.result', {
                    serverId: message.serverId,
                    tools: result
                }, requestId);
            }
            catch (error) {
                this.eventBus.emit('mcp.tool.list.error', { error: error.message }, requestId);
            }
        });
        // Listen for agent task requests that might involve MCP
        this.eventBus.on('agent.task.mcp', async (message, agentId, requestId) => {
            try {
                const result = await this.mcpAdapter.handleAgentMCPRequest(message, agentId);
                this.eventBus.emit('agent.task.mcp.result', result, requestId);
            }
            catch (error) {
                this.eventBus.emit('agent.task.mcp.error', { error: error.message }, requestId);
            }
        });
        // Agent MCP Servers List Request
        this.eventBus.on('agent.mcp.servers.list', (message, requestId) => {
            try {
                const servers = this.mcpAdapter.listMCPServers(message.filters || {});
                this.eventBus.emit('agent.mcp.servers.list.result', {
                    servers
                }, requestId);
            }
            catch (error) {
                this.eventBus.emit('agent.mcp.servers.list.error', { error: error.message }, requestId);
            }
        });
        // Agent MCP Tools List Request
        this.eventBus.on('agent.mcp.tools.list', async (message, requestId) => {
            try {
                const tools = await this.mcpAdapter.listMCPTools(message.serverId);
                this.eventBus.emit('agent.mcp.tools.list.result', {
                    serverId: message.serverId,
                    serverName: message.serverId, // Using serverId as fallback name
                    tools
                }, requestId);
            }
            catch (error) {
                this.eventBus.emit('agent.mcp.tools.list.error', { error: error.message }, requestId);
            }
        });
        // Agent MCP Tool Execute Request
        this.eventBus.on('agent.mcp.tool.execute', async (message, requestId) => {
            try {
                const result = await this.mcpAdapter.executeMCPTool(message.serverId, message.toolName, message.parameters);
                this.eventBus.emit('agent.mcp.tool.execute.result', {
                    serverId: message.serverId,
                    toolName: message.toolName,
                    result,
                    status: 'success'
                }, requestId);
            }
            catch (error) {
                this.eventBus.emit('agent.mcp.tool.execute.error', {
                    serverId: message.serverId,
                    toolName: message.toolName,
                    status: 'error',
                    error: error.message
                }, requestId);
            }
        });
        // Listen for task created events
        this.eventBus.on('task.created', (taskId, agentId, clientId, taskData) => {
            console.log(`Task ${taskId} created for agent ${agentId} by client ${clientId}`);
            // Get the agent connection
            const connection = this.agents.getConnectionByAgentId(agentId);
            if (!connection) {
                console.error(`Cannot send task ${taskId} to agent ${agentId}: Agent connection not found`);
                this.tasks.updateTaskStatus(taskId, 'failed', {
                    error: 'Agent connection not found',
                    metadata: {
                        failedAt: new Date().toISOString()
                    }
                });
                // Notify client if one is specified
                if (clientId) {
                    this.clientServer.sendMessageToClient(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.error',
                        content: {
                            taskId,
                            error: 'Agent connection not found',
                            message: 'Cannot deliver task to agent: not connected'
                        }
                    });
                }
                return;
            }
            // Create a task message to send to the agent
            const taskMessage = {
                id: taskId,
                type: 'task.execute',
                content: {
                    taskId: taskId,
                    type: taskData.taskType,
                    data: taskData
                }
            };
            // Send the task to the agent
            try {
                this.agentServer.send(connection, taskMessage);
                console.log(`Task ${taskId} sent to agent ${agentId}`);
                // Update task status to running
                this.tasks.updateTaskStatus(taskId, 'running', {
                    metadata: {
                        startedAt: new Date().toISOString()
                    }
                });
                // Notify client if one is specified
                if (clientId) {
                    this.clientServer.sendMessageToClient(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.status',
                        content: {
                            taskId,
                            status: 'running',
                            agentId,
                            message: 'Task sent to agent'
                        }
                    });
                }
            }
            catch (error) {
                console.error(`Error sending task ${taskId} to agent ${agentId}:`, error);
                this.tasks.updateTaskStatus(taskId, 'failed', {
                    error: error instanceof Error ? error.message : String(error),
                    metadata: {
                        failedAt: new Date().toISOString()
                    }
                });
                // Notify client if one is specified
                if (clientId) {
                    this.clientServer.sendMessageToClient(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.error',
                        content: {
                            taskId,
                            error: error instanceof Error ? error.message : String(error),
                            message: 'Failed to send task to agent'
                        }
                    });
                }
            }
        });
        // NEW: Handle task completion events
        this.eventBus.on('task.result', (message, connectionId) => {
            try {
                const { taskId, result } = message.content;
                if (!taskId) {
                    console.error('Task result received without task ID');
                    return;
                }
                // Get the task
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    console.error(`Task ${taskId} not found for result`);
                    return;
                }
                // Update task status
                this.tasks.updateTaskStatus(taskId, 'completed', {
                    result,
                    metadata: {
                        completedAt: new Date().toISOString()
                    }
                });
                // Notify client if one is specified
                if (task.clientId) {
                    this.clientServer.send(task.clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.result',
                        content: {
                            taskId,
                            result,
                            status: 'completed',
                            agentId: task.agentId,
                            completedAt: new Date().toISOString()
                        }
                    });
                }
                // If this is a child task, notify the requesting agent
                if (task.requestingAgentId) {
                    const requestingAgent = this.agents.getAgentById(task.requestingAgentId);
                    if (requestingAgent && requestingAgent.connectionId) {
                        this.agentServer.send(requestingAgent.connectionId, {
                            id: (0, uuid_1.v4)(),
                            type: 'childagent.response',
                            content: {
                                childTaskId: taskId,
                                result,
                                status: 'completed'
                            }
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error handling task result:', error);
            }
        });
        // NEW: Handle task error events
        this.eventBus.on('task.error', (message, connectionId) => {
            try {
                const { taskId, error } = message.content;
                if (!taskId) {
                    console.error('Task error received without task ID');
                    return;
                }
                // Get the task
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    console.error(`Task ${taskId} not found for error`);
                    return;
                }
                // Update task status
                this.tasks.updateTaskStatus(taskId, 'failed', {
                    error: error || 'Unknown error',
                    metadata: {
                        failedAt: new Date().toISOString()
                    }
                });
                // Notify client if one is specified
                if (task.clientId) {
                    this.clientServer.send(task.clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.error',
                        content: {
                            taskId,
                            error: error || 'Unknown error',
                            status: 'failed',
                            agentId: task.agentId,
                            failedAt: new Date().toISOString()
                        }
                    });
                }
                // If this is a child task, notify the requesting agent
                if (task.requestingAgentId) {
                    const requestingAgent = this.agents.getAgentById(task.requestingAgentId);
                    if (requestingAgent && requestingAgent.connectionId) {
                        this.agentServer.send(requestingAgent.connectionId, {
                            id: (0, uuid_1.v4)(),
                            type: 'childagent.response',
                            content: {
                                childTaskId: taskId,
                                error: error || 'Unknown error',
                                status: 'failed'
                            }
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error handling task error:', error);
            }
        });
        // NEW: Handle service task notifications
        this.eventBus.on('service.task.notification', (message, connectionId) => {
            try {
                const { serviceId, taskId, notification } = message.content;
                // Get the service task
                const serviceTask = this.serviceTasks.getTask(taskId);
                if (!serviceTask) {
                    console.error(`Service task ${taskId} not found for notification`);
                    return;
                }
                // Notify client if one is specified
                if (serviceTask.clientId) {
                    this.clientServer.send(serviceTask.clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'service.notification',
                        content: {
                            serviceTaskId: taskId,
                            serviceId,
                            notification,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                // Notify the requesting agent if one exists
                if (serviceTask.agentId) {
                    const agent = this.agents.getAgentById(serviceTask.agentId);
                    if (agent && agent.connectionId) {
                        this.agentServer.send(agent.connectionId, {
                            id: (0, uuid_1.v4)(),
                            type: 'service.notification',
                            content: {
                                serviceTaskId: taskId,
                                serviceId,
                                notification,
                                timestamp: new Date().toISOString()
                            }
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error handling service task notification:', error);
            }
        });
        // NEW: Handle service task results
        this.eventBus.on('service.task.result.received', (message, connectionId) => {
            try {
                const { taskId, result } = message.content;
                if (!taskId) {
                    console.error('Service task result received without task ID');
                    return;
                }
                // Get the service task
                const serviceTask = this.serviceTasks.getTask(taskId);
                if (!serviceTask) {
                    console.error(`Service task ${taskId} not found for result`);
                    return;
                }
                // Update service task status
                this.serviceTasks.updateTaskStatus(taskId, 'completed', {
                    result
                });
                // Send service completed notification to client if one is specified
                if (serviceTask.clientId) {
                    this.clientServer.send(serviceTask.clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'service.completed',
                        content: {
                            serviceTaskId: taskId,
                            serviceId: serviceTask.serviceId,
                            result,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                // Notify the requesting agent if one exists
                if (serviceTask.agentId) {
                    const agent = this.agents.getAgentById(serviceTask.agentId);
                    if (agent && agent.connectionId) {
                        this.agentServer.send(agent.connectionId, {
                            id: (0, uuid_1.v4)(),
                            type: 'service.response',
                            content: {
                                serviceTaskId: taskId,
                                serviceId: serviceTask.serviceId,
                                result,
                                status: 'completed'
                            }
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error handling service task result:', error);
            }
        });
        // NEW: Handle missing client events that are emitted but not handled
        // Handle client task creation requests
        this.eventBus.on('client.task.create.request', (message, clientId) => {
            try {
                const { agentId, agentName, taskData } = message.content;
                if (!agentId && !agentName) {
                    this.clientServer.sendError(clientId, 'Agent ID or agent name is required', message.id);
                    return;
                }
                // Find the agent
                let agent = agentId ? this.agents.getAgentById(agentId) : this.agents.getAgentByName(agentName);
                if (!agent) {
                    this.clientServer.sendError(clientId, `Agent ${agentId || agentName} not found`, message.id);
                    return;
                }
                // Create a task
                const taskId = (0, uuid_1.v4)();
                // Register the task
                this.tasks.registerTask(taskId, {
                    type: 'client.task',
                    name: `Client task for ${agent.name}`,
                    severity: 'normal',
                    agentId: agent.id,
                    clientId: clientId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData: taskData || {}
                });
                // Send task to agent
                if (agent.connectionId) {
                    this.agentServer.send(agent.connectionId, {
                        id: taskId,
                        type: 'task.execute',
                        content: {
                            taskId,
                            taskData: taskData || {},
                            clientId,
                            metadata: {
                                clientId,
                                timestamp: new Date().toISOString()
                            }
                        }
                    });
                }
                // Send response to client
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'task.created',
                    content: {
                        taskId,
                        agentId: agent.id,
                        agentName: agent.name,
                        status: 'created'
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error creating task', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Handle client task status requests
        this.eventBus.on('client.task.status.request', (message, clientId) => {
            try {
                const { taskId } = message.content;
                if (!taskId) {
                    this.clientServer.sendError(clientId, 'Task ID is required', message.id);
                    return;
                }
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    this.clientServer.sendError(clientId, `Task ${taskId} not found`, message.id);
                    return;
                }
                // Send task status to client
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'task.status',
                    content: {
                        taskId,
                        status: task.status,
                        agentId: task.agentId,
                        createdAt: task.createdAt,
                        result: task.result
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error getting task status', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Handle client agent list requests
        this.eventBus.on('client.agent.list.request', (message, clientId, clientServer) => {
            try {
                const filters = message.content?.filters || {};
                const agents = this.agents.getAllAgents();
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.list',
                    content: {
                        agents: agents.map((agent) => ({
                            id: agent.id,
                            name: agent.name,
                            capabilities: agent.capabilities,
                            status: agent.status,
                            registeredAt: agent.registeredAt
                        }))
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error getting agent list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Handle client MCP server list requests
        this.eventBus.on('client.mcp.server.list.request', (message, clientId) => {
            try {
                const servers = this.mcpAdapter.getServerList();
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'mcp.server.list',
                    content: {
                        servers: servers.map((server) => ({
                            id: server.id,
                            name: server.name,
                            status: server.status,
                            capabilities: server.capabilities
                        }))
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error getting MCP server list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Handle client MCP server tools requests
        this.eventBus.on('client.mcp.server.tools.request', (message, clientId) => {
            try {
                const { serverId } = message.content;
                if (!serverId) {
                    this.clientServer.sendError(clientId, 'Server ID is required', message.id);
                    return;
                }
                const tools = this.mcpAdapter.getServerList().find((server) => server.id === serverId)?.tools || [];
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'mcp.server.tools',
                    content: {
                        serverId,
                        tools
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error getting MCP server tools', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Handle client MCP tool execution requests
        this.eventBus.on('client.mcp.tool.execute.request', (message, clientId) => {
            try {
                const { serverId, toolName, parameters } = message.content;
                if (!serverId || !toolName) {
                    this.clientServer.sendError(clientId, 'Server ID and tool name are required', message.id);
                    return;
                }
                // Execute the MCP tool
                this.mcpAdapter.executeMCPTool(serverId, toolName, parameters || {})
                    .then((result) => {
                    this.clientServer.send(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'mcp.tool.execution.result',
                        content: {
                            serverId,
                            toolName,
                            result
                        },
                        requestId: message.id
                    });
                })
                    .catch((error) => {
                    this.clientServer.sendError(clientId, 'Error executing MCP tool', message.id, error instanceof Error ? error.message : String(error));
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error executing MCP tool', message.id, error instanceof Error ? error.message : String(error));
            }
        });
    }
    //OK
    /**
     * Start the orchestrator and all its servers
     */
    async start() {
        try {
            console.log(`Starting Agent Swarm Protocol Orchestrator (${this.logLevel} mode)`);
            // Start the WebSocket servers
            await this.agentServer.start();
            console.log(`Agent server started on port ${this.port}`);
            await this.clientServer.start();
            console.log(`Client server started on port ${this.clientPort}`);
            await this.serviceServer.start();
            console.log(`Service server started on port ${this.servicePort}`);
            // Initialize components from config if available
            await this.initMCPServersFromConfig();
            await this.initAgentsFromConfig();
            await this.initServicesFromConfig();
            console.log('Orchestrator ready!');
        }
        catch (error) {
            console.error('Failed to start orchestrator:', error);
            throw error;
        }
    }
    //Ok
    /**
     * Initialize MCP servers from configuration
     */
    async initMCPServersFromConfig() {
        const mcpServers = this.configLoader.getMCPServers();
        if (mcpServers && mcpServers.length > 0) {
            for (const serverConfig of mcpServers) {
                try {
                    // Include command and args from the config
                    await this.mcpAdapter.registerMCPServer({
                        id: serverConfig.id || (0, uuid_1.v4)(),
                        name: serverConfig.name,
                        type: serverConfig.type || 'node',
                        capabilities: serverConfig.capabilities || [],
                        path: serverConfig.path,
                        command: serverConfig.command,
                        args: serverConfig.args,
                        metadata: serverConfig.metadata || {}
                    });
                    console.log(`Registered MCP server: ${serverConfig.name}`);
                }
                catch (error) {
                    console.error(`Failed to register MCP server ${serverConfig.name}:`, error);
                }
            }
        }
    }
    // Can skip this logic and rely on the Agent.register() method
    /**
     * Initialize agents from configuration
     */
    async initAgentsFromConfig() {
        const agentConfigs = this.configLoader.getAgentConfigurations();
        if (agentConfigs && Object.keys(agentConfigs).length > 0) {
            console.log(`Loaded ${Object.keys(agentConfigs).length} agent configurations`);
            for (const [agentName, config] of Object.entries(agentConfigs)) {
                // This just preloads the configurations, agents still need to connect
                this.agents.addAgentConfiguration(agentName, config);
            }
        }
    }
    // Can skip this logic and rely on the Service.register() method
    /**
     * Initialize services from configuration
     */
    async initServicesFromConfig() {
        const serviceConfigs = this.configLoader.getServiceConfigurations();
        if (serviceConfigs && Object.keys(serviceConfigs).length > 0) {
            console.log(`Loaded ${Object.keys(serviceConfigs).length} service configurations`);
            for (const [serviceName, config] of Object.entries(serviceConfigs)) {
                // This just preloads the configurations, services still need to connect
                this.services.setServiceConfiguration(serviceName, config);
            }
        }
    }
    //LOW LEVEL FUNCTION
    /**
     * Send a message to a WebSocket connection or to a connection ID and wait for a response
     * @param wsOrConnectionId - WebSocket object or connection ID
     * @param message - Message to send
     * @param options - Send options
     * @returns Promise resolving with the response
     */
    async sendAndWaitForResponse(wsOrConnectionId, message, options = {}) {
        const messageId = message.id || (0, uuid_1.v4)();
        const timeout = options.timeout || 30000;
        // Ensure the message has an ID
        if (!message.id) {
            message.id = messageId;
        }
        // Create a promise that will be resolved with the response
        const responsePromise = new Promise((resolve, reject) => {
            // Set a timeout to reject the promise
            const timeoutId = setTimeout(() => {
                delete this.pendingResponses[messageId];
                reject(new Error(`Request timed out after ${timeout}ms`));
            }, timeout);
            // Store the pending response information
            this.pendingResponses[messageId] = {
                resolve,
                reject,
                timer: timeoutId
            };
        });
        // Determine if we need to get a WebSocket from a connection ID
        let ws;
        if (typeof wsOrConnectionId === 'string') {
            // Get the WebSocket from the connection ID
            const connection = this.agents.getConnection(wsOrConnectionId);
            if (!connection) {
                delete this.pendingResponses[messageId];
                throw new Error(`Connection with ID ${wsOrConnectionId} not found`);
            }
            ws = connection;
        }
        else {
            // Use the provided WebSocket
            ws = wsOrConnectionId;
        }
        // Add timestamp to the message if not already present
        if (!message.timestamp) {
            message.timestamp = Date.now().toString();
        }
        // Send the message to the client
        ws.send(JSON.stringify(message));
        // Wait for the response
        return responsePromise;
    }
    // This should be removed and replaced with specific handlers for each message type
    /**
     * Handle response messages for outstanding requests
     */
    handleResponseMessage(message) {
        const requestId = message.requestId;
        if (requestId && this.pendingResponses[requestId]) {
            const { resolve, timer } = this.pendingResponses[requestId];
            // Clear the timeout and delete the pending response
            clearTimeout(timer);
            delete this.pendingResponses[requestId];
            // Resolve the promise with the response message
            resolve(message);
        }
    }
    /**
     * Stop the orchestrator and all its servers
     */
    async stop() {
        try {
            console.log('Stopping Orchestrator...');
            // Close all pending responses
            for (const [messageId, pendingResponse] of Object.entries(this.pendingResponses)) {
                clearTimeout(pendingResponse.timer);
                pendingResponse.reject(new Error('Orchestrator is shutting down'));
                delete this.pendingResponses[messageId];
            }
            // Stop all servers
            await this.agentServer.stop();
            await this.clientServer.stop();
            await this.serviceServer.stop();
            console.log('Orchestrator stopped.');
        }
        catch (error) {
            console.error('Error stopping orchestrator:', error);
            throw error;
        }
    }
}
exports.Orchestrator = Orchestrator;
// Create and export singleton orchestrator instance
const orchestrator = new Orchestrator();
exports.default = orchestrator;
