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
        this.mcp = mcp.setup(this.eventBus);
        // Create message handler to centralize business logic
        this.messageHandler = new message_handler_1.default({
            agents: this.agents,
            tasks: this.tasks,
            services: this.services,
            serviceTasks: this.serviceTasks,
            clients: this.clients,
            eventBus: this.eventBus,
            mcp: this.mcp
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
                connection.send(JSON.stringify({
                    ...taskMessage,
                    timestamp: Date.now().toString()
                }));
                console.log(`Task ${taskId} sent to agent ${agentId}`);
                // Update task status to in_progress
                this.tasks.updateTaskStatus(taskId, 'in_progress', {
                    note: 'Task sent to agent',
                    metadata: {
                        sentAt: new Date().toISOString()
                    }
                });
            }
            catch (error) {
                console.error(`Error sending task to agent: ${error instanceof Error ? error.message : String(error)}`);
                this.tasks.updateTaskStatus(taskId, 'failed', {
                    error: error instanceof Error ? error.message : String(error),
                    metadata: {
                        failedAt: new Date().toISOString()
                    }
                });
                // Notify client
                if (clientId) {
                    this.clientServer.sendMessageToClient(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.error',
                        content: {
                            taskId,
                            error: 'Failed to send task to agent',
                            message: error instanceof Error ? error.message : String(error)
                        }
                    });
                }
            }
        });
        // Handle agent messages (moved from agent-server.ts)
        // Register handlers for specific message types
        // Agent registration
        this.eventBus.on('agent.register', (message, connectionId, agentServer) => {
            try {
                const registrationResult = this.agentServer.handleAgentRegistration(message, connectionId);
                if (registrationResult.error) {
                    agentServer.sendError(connectionId, registrationResult.error, message.id);
                    return;
                }
                agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.registered',
                    content: registrationResult,
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // Agent list request
        this.eventBus.on('agent.list.request', (message, connectionId, agentServer) => {
            try {
                const filters = message.content?.filters || {};
                // Get agent list from registry
                const agents = this.messageHandler.getAgentList(filters);
                // Send response
                agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.list.response',
                    content: {
                        agents: agents
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // Service list request
        this.eventBus.on('service.list', (message, connectionId, agentServer) => {
            try {
                const filters = message.content?.filters || {};
                // Get service list directly
                const services = this.services.getAllServices(filters);
                // Send response
                agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.list.result',
                    content: {
                        services
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // Service task execution
        this.eventBus.on('service.task.execute', async (message, connectionId, serviceServer) => {
            try {
                const result = await this.messageHandler.handleServiceTaskExecuteRequest(message, connectionId);
                // Instead of using a callback, send response directly through the serviceServer
                serviceServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.task.result',
                    content: result,
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                // Send error through serviceServer
                serviceServer.sendError(connectionId, 'Error executing service task', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Task result
        this.eventBus.on('task.result', (message, connectionId, agentServer) => {
            // Emit task result event
            this.eventBus.emit('task.result.received', message);
            // No response needed
        });
        // Task error
        this.eventBus.on('task.error', (message, connectionId, agentServer) => {
            // Emit task error event
            this.eventBus.emit('task.error.received', message);
            // No response needed
        });
        // Task status
        this.eventBus.on('task.status', (message, connectionId, agentServer) => {
            console.log(`Task status update received: ${message.content.taskId} status: ${message.content.status}`);
            this.eventBus.emit('task.status.received', message);
            // No response needed
        });
        // Service task result
        this.eventBus.on('service.task.result', (message, connectionId, agentServer) => {
            console.log(`Service task result received: ${message.id}`);
            this.eventBus.emit('service.task.result.received', message);
            // No response needed
        });
        // Task notification
        this.eventBus.on('task.notification', (message, connectionId, agentServer) => {
            // Get the agent information from the connection
            const agent = this.agents.getAgentByConnectionId(connectionId);
            if (!agent) {
                agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
                return;
            }
            // Enhance the notification with agent information
            const enhancedNotification = {
                ...message,
                content: {
                    ...message.content,
                    agentId: agent.id,
                    agentName: agent.name
                }
            };
            // Emit the notification event for the orchestrator to handle
            this.eventBus.emit('task.notification.received', enhancedNotification);
            // Confirm receipt
            agentServer.send(connectionId, {
                id: (0, uuid_1.v4)(),
                type: 'notification.received',
                content: {
                    message: 'Notification received',
                    notificationId: message.id
                },
                requestId: message.id,
                timestamp: Date.now().toString()
            });
        });
        // Agent status
        this.eventBus.on('agent.status', (message, connectionId, agentServer) => {
            // Get the agent information from the connection
            const statusAgent = this.agents.getAgentByConnectionId(connectionId);
            if (!statusAgent) {
                agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
                return;
            }
            // Update agent status in the registry
            this.agents.updateAgentStatus(statusAgent.id, message.content.status, message.content);
            // Confirm receipt
            agentServer.send(connectionId, {
                id: (0, uuid_1.v4)(),
                type: 'agent.status.updated',
                content: {
                    message: 'Agent status updated',
                    status: message.content.status
                },
                requestId: message.id,
                timestamp: Date.now().toString()
            });
        });
        // MCP servers list
        this.eventBus.on('mcp.servers.list', (message, connectionId, agentServer) => {
            try {
                const response = this.messageHandler.handleMessage(message, connectionId);
                agentServer.send(connectionId, {
                    ...response,
                    id: (0, uuid_1.v4)(),
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // MCP tools list
        this.eventBus.on('mcp.tools.list', (message, connectionId, agentServer) => {
            try {
                const response = this.messageHandler.handleMessage(message, connectionId);
                agentServer.send(connectionId, {
                    ...response,
                    id: (0, uuid_1.v4)(),
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // MCP tool execute
        this.eventBus.on('mcp.tool.execute', (message, connectionId, agentServer) => {
            try {
                const response = this.messageHandler.handleMessage(message, connectionId);
                agentServer.send(connectionId, {
                    ...response,
                    id: (0, uuid_1.v4)(),
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // Ping
        this.eventBus.on('ping', (message, connectionId, agentServer) => {
            agentServer.send(connectionId, {
                id: (0, uuid_1.v4)(),
                type: 'pong',
                content: {
                    timestamp: Date.now()
                },
                requestId: message.id,
                timestamp: Date.now().toString()
            });
        });
        // Backward compatibility: MCP servers list request (UPDATED to direct response pattern)
        this.eventBus.on('mcp.servers.list.request', (message, connectionId, serverObj) => {
            try {
                const filters = message.content?.filters || {};
                // Get MCP server list
                const servers = this.mcp.getServerList(filters);
                // Send response through the appropriate server
                serverObj.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'mcp.servers.list.response',
                    content: {
                        servers: servers
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                serverObj.sendError(connectionId, 'Error getting MCP server list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Backward compatibility: MCP tools list request (UPDATED to direct response pattern)
        this.eventBus.on('mcp.tools.list.request', (message, connectionId, serverObj) => {
            try {
                const serverId = message.content?.serverId;
                if (!serverId) {
                    serverObj.sendError(connectionId, 'Server ID is required', message.id);
                    return;
                }
                // Get tools for the server
                const tools = this.mcp.getToolList(serverId);
                // Send response
                serverObj.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'mcp.tools.list.response',
                    content: {
                        serverId,
                        tools
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                serverObj.sendError(connectionId, 'Error getting MCP tools list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Backward compatibility: MCP tool execute request (UPDATED to direct response pattern)
        this.eventBus.on('mcp.tool.execute.request', async (message, connectionId, serverObj) => {
            try {
                const params = message.content || {};
                const { serverId, toolName, parameters } = params;
                if (!serverId || !toolName) {
                    serverObj.sendError(connectionId, 'Server ID and tool name are required', message.id);
                    return;
                }
                try {
                    // Execute the tool (using await for cleaner code)
                    const result = await this.mcp.executeServerTool(serverId, toolName, parameters || {});
                    // Send success response
                    serverObj.send(connectionId, {
                        id: (0, uuid_1.v4)(),
                        type: 'mcp.tool.execution.result',
                        content: {
                            serverId,
                            toolName,
                            status: 'success',
                            result
                        },
                        requestId: message.id,
                        timestamp: Date.now().toString()
                    });
                }
                catch (toolError) {
                    // Send tool execution error
                    serverObj.send(connectionId, {
                        id: (0, uuid_1.v4)(),
                        type: 'mcp.tool.execution.result',
                        content: {
                            serverId,
                            toolName,
                            status: 'error',
                            error: toolError instanceof Error ? toolError.message : String(toolError)
                        },
                        requestId: message.id,
                        timestamp: Date.now().toString()
                    });
                }
            }
            catch (error) {
                // Send general error
                serverObj.sendError(connectionId, 'Error executing MCP tool', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Listen for task status update events
        this.eventBus.on('task.status.received', (message) => {
            try {
                const { taskId, status, agentId } = message.content;
                console.log(`Processing task status update: ${taskId} status: ${status}`);
                if (taskId && status) {
                    // Update task status in the registry
                    this.tasks.updateTaskStatus(taskId, status, message.content);
                    // Get the task information
                    const task = this.tasks.getTask(taskId);
                    if (task && task.clientId && typeof task.clientId === 'string') {
                        // For in_progress status, only forward the status update without marking as completed
                        if (status === 'in_progress') {
                            console.log(`Forwarding in-progress status update to client: ${task.clientId}`);
                            this.clientServer.sendMessageToClient(task.clientId, {
                                id: (0, uuid_1.v4)(),
                                type: 'task.status',
                                content: {
                                    taskId,
                                    status,
                                    agentId,
                                    timestamp: Date.now().toString()
                                }
                            });
                        }
                        // For completed status, verify this is a real completion (not just an in-progress update with result)
                        else if (status === 'completed') {
                            console.log(`Forwarding completion status update to client: ${task.clientId}`);
                            // Check if this message contains a task.result property to verify it's the final completion
                            // This helps filter out intermediate result updates that should not be treated as completion
                            const hasTaskResult = message.content.result &&
                                (typeof message.content.result === 'object' ||
                                    typeof message.content.result === 'string');
                            // Send the status update
                            this.clientServer.sendMessageToClient(task.clientId, {
                                id: (0, uuid_1.v4)(),
                                type: 'task.status',
                                content: {
                                    taskId,
                                    status,
                                    agentId,
                                    result: hasTaskResult ? message.content.result : null,
                                    timestamp: Date.now().toString()
                                }
                            });
                            // Only send task.result message if we have a result and this appears to be the final completion
                            if (hasTaskResult) {
                                console.log(`Sending task.result for completed task ${taskId} to client ${task.clientId}`);
                                this.clientServer.sendMessageToClient(task.clientId, {
                                    id: (0, uuid_1.v4)(),
                                    type: 'task.result',
                                    content: {
                                        taskId,
                                        status: 'completed',
                                        result: message.content.result,
                                        completedAt: new Date().toISOString()
                                    }
                                });
                            }
                        }
                        // For failed status, forward as is
                        else if (status === 'failed') {
                            console.log(`Forwarding failed status update to client: ${task.clientId}`);
                            this.clientServer.sendMessageToClient(task.clientId, {
                                id: (0, uuid_1.v4)(),
                                type: 'task.status',
                                content: {
                                    taskId,
                                    status,
                                    agentId,
                                    error: message.content.error,
                                    timestamp: Date.now().toString()
                                }
                            });
                        }
                    }
                    else if (task && task.clientId) {
                        console.warn(`Invalid client ID for task ${taskId}: ${typeof task.clientId}`);
                    }
                }
            }
            catch (error) {
                console.error(`Error handling task status update:`, error);
            }
        });
        // Listen for service task created events
        this.eventBus.on('service.task.created', (taskId, serviceId, agentId, clientId, taskData) => {
            console.log(`Service task ${taskId} created for service ${serviceId} by agent ${agentId}`);
            // Get the service connection
            const service = this.services.getServiceById(serviceId);
            if (service && service.connectionId) {
                // Create a task message to send to the service
                const taskMessage = {
                    id: taskId,
                    type: 'service.task.execute',
                    content: {
                        ...taskData,
                        functionName: taskData.functionName,
                        params: taskData.params || {},
                        metadata: {
                            agentId: agentId,
                            clientId: clientId,
                            timestamp: new Date().toISOString()
                        }
                    }
                };
                // Send the task to the service
                this.sendAndWaitForResponse(service.connectionId, taskMessage)
                    .then(response => {
                    // Task completed by service
                    this.serviceTasks.updateTaskStatus(taskId, 'completed', response);
                    this.eventBus.emit('response.message', response);
                })
                    .catch(error => {
                    // Task failed
                    console.error(`Error sending task to service: ${error.message}`);
                    this.serviceTasks.updateTaskStatus(taskId, 'failed', { error: error.message });
                });
            }
            else {
                console.error(`Cannot send task ${taskId} to service ${serviceId}: Service not connected`);
                this.serviceTasks.updateTaskStatus(taskId, 'failed', { error: 'Service not connected' });
            }
        });
        // Listen for agent-to-agent request events
        this.eventBus.on('agent.request', (taskId, targetAgentId, requestingAgentId, taskMessage) => {
            console.log(`Agent ${requestingAgentId} requesting task ${taskId} from agent ${targetAgentId}`);
            // Get the connections needed
            const targetAgent = this.agents.getAgentById(targetAgentId);
            if (targetAgent && targetAgent.connectionId) {
                // Send the task to the target agent
                this.sendAndWaitForResponse(targetAgent.connectionId, taskMessage)
                    .then(response => {
                    // Task completed by target agent
                    this.tasks.updateTaskStatus(taskId, 'completed', response);
                    this.eventBus.emit('response.message', response);
                })
                    .catch(error => {
                    // Task failed
                    console.error(`Error in agent-to-agent request: ${error.message}`);
                    this.tasks.updateTaskStatus(taskId, 'failed', { error: error.message });
                });
            }
        });
        // Handle response messages
        this.eventBus.on('response.message', (message) => {
            if (message && message.requestId) {
                this.handleResponseMessage(message);
            }
        });
        // Handle task result forwarding to client
        this.eventBus.on('task.result', (clientId, taskId, content) => {
            if (clientId && this.clientServer.hasClientConnection(clientId)) {
                this.clientServer.forwardTaskResultToClient(clientId, taskId, content);
            }
        });
        this.eventBus.on('task.error', (clientId, message) => {
            if (clientId && this.clientServer.hasClientConnection(clientId)) {
                this.clientServer.forwardTaskErrorToClient(clientId, message);
            }
        });
        this.eventBus.on('task.notification', (clientId, content) => {
            if (clientId && this.clientServer.hasClientConnection(clientId)) {
                this.clientServer.forwardTaskNotificationToClient(clientId, content);
            }
        });
        this.eventBus.on('service.notification', (clientId, content) => {
            if (clientId && this.clientServer.hasClientConnection(clientId)) {
                this.clientServer.forwardServiceNotificationToClient(clientId, content);
            }
        });
        this.eventBus.on('mcp.task.execution', (clientId, content) => {
            if (clientId && this.clientServer.hasClientConnection(clientId)) {
                this.clientServer.forwardMCPTaskExecutionToClient(clientId, content);
            }
        });
        // Generic message forwarding to clients
        this.eventBus.on('message.forwardToClient', (message) => {
            // Determine the type of message to forward
            if (!message || !message.type || !message.clientId) {
                console.warn('Invalid message for forwarding to client:', message);
                return;
            }
            // Handle different message types with switch-case for better readability
            if (this.clientServer.hasClientConnection(message.clientId)) {
                switch (message.type) {
                    case 'task.result':
                        this.clientServer.forwardTaskResultToClient(message.clientId, message.taskId, message.content);
                        break;
                    case 'task.error':
                        this.clientServer.forwardTaskErrorToClient(message.clientId, message);
                        break;
                    case 'task.notification':
                        this.clientServer.forwardTaskNotificationToClient(message.clientId, message.content);
                        break;
                    case 'service.notification':
                        this.clientServer.forwardServiceNotificationToClient(message.clientId, message.content);
                        break;
                    case 'mcp.task.execution':
                        this.clientServer.forwardMCPTaskExecutionToClient(message.clientId, message.content);
                        break;
                    default:
                        console.warn(`Unhandled client message forwarding type: ${message.type}`);
                        break;
                }
            }
            else {
                console.log(`Client ${message.clientId} is not connected, cannot forward message of type ${message.type}`);
            }
        });
        // Handle client agent list requests
        this.eventBus.on('client.agent.list', (message, clientId, clientServer) => {
            // Redirect to the handler that doesn't use callbacks
            this.eventBus.emit('client.agent.list.request', message, clientId, clientServer);
        });
        // Handle client service list requests
        this.eventBus.on('client.service.list', (message, clientId, clientServer) => {
            // Redirect to the handler that doesn't use callbacks
            this.eventBus.emit('client.service.list.request', message, clientId, clientServer);
        });
        // Handle agent list requests from agents
        this.eventBus.on('agent.list.request', (message, connectionId, agentServer) => {
            try {
                const filters = message.content?.filters || {};
                // Get agent list from registry
                const agents = this.messageHandler.getAgentList(filters);
                // Send response
                agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.list.response',
                    content: {
                        agents: agents
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // Handle MCP servers list requests
        this.eventBus.on('agent.status.update', (message, connectionId, agentServer) => {
            try {
                const agent = this.agents.getAgentByConnectionId(connectionId);
                if (!agent) {
                    agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
                    return;
                }
                const { status, message: statusMessage } = message.content;
                if (!status) {
                    agentServer.sendError(connectionId, 'Status is required for status update', message.id);
                    return;
                }
                // Update agent status in the registry
                this.agents.updateAgentStatus(agent.id, status, {
                    message: statusMessage,
                    updatedAt: new Date().toISOString()
                });
                // Send success response directly
                agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.status.updated',
                    content: {
                        agentId: agent.id,
                        status,
                        message: `Agent status updated to ${status}`
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
                // Emit an event about the status change
                this.eventBus.emit('agent.status.changed', agent.id, status, statusMessage);
                console.log(`Agent ${agent.name} (${agent.id}) status updated to ${status}`);
            }
            catch (error) {
                agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
            }
        });
        // Handle client messages to agents
        this.eventBus.on('client.message.agent', async (message, targetAgentId, clientServer) => {
            try {
                // Extract the client ID from the message
                const clientId = message.content.sender.id;
                // Create a task for the agent
                const taskId = (0, uuid_1.v4)();
                const conversationId = (0, uuid_1.v4)(); // Generate a conversation ID if not provided
                const taskData = {
                    taskType: 'conversation:message',
                    conversationId,
                    message: message.content.text,
                    role: message.content.role || 'user',
                    context: {
                        messageHistory: [],
                        metadata: {
                            clientId: clientId,
                            timestamp: message.timestamp || new Date().toISOString()
                        }
                    }
                };
                // Register task in task registry
                this.tasks.registerTask(taskId, {
                    type: 'agent.task',
                    name: 'Client Message',
                    severity: 'normal',
                    agentId: targetAgentId,
                    clientId: clientId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData
                });
                // Emit task created event
                this.eventBus.emit('task.created', taskId, targetAgentId, clientId, taskData);
                // Send response back to the client
                clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'message.sent',
                    content: {
                        taskId,
                        status: 'pending',
                        target: {
                            type: 'agent',
                            id: targetAgentId
                        }
                    },
                    requestId: message.id,
                    timestamp: Date.now().toString()
                });
            }
            catch (error) {
                console.error('Error handling client message:', error);
                const clientId = message.content?.sender?.id;
                if (clientId) {
                    clientServer.sendError(clientId, 'Error sending message to agent', message.id, error instanceof Error ? error.message : String(error));
                }
            }
        });
        // Handle service notifications
        this.eventBus.on('service.notification.received', (message) => {
            if (message.content && message.content.metadata) {
                const { clientId, agentId } = message.content.metadata;
                // Forward to client if clientId is available
                if (clientId && this.clientServer.hasClientConnection(clientId)) {
                    this.clientServer.forwardServiceNotificationToClient(clientId, message.content);
                }
                // Forward to agent if agentId is available
                if (agentId) {
                    const agent = this.agents.getAgentById(agentId);
                    if (agent && agent.connectionId) {
                        try {
                            this.agentServer.send(agent.connectionId, {
                                id: (0, uuid_1.v4)(),
                                type: 'service.notification',
                                content: message.content,
                                timestamp: Date.now().toString()
                            });
                        }
                        catch (error) {
                            console.warn(`Error forwarding service notification to agent ${agentId}:`, error);
                        }
                    }
                    else {
                        console.warn(`Cannot forward service notification to agent ${agentId}: Agent not connected`);
                    }
                }
            }
        });
        // Handle task notifications
        this.eventBus.on('task.notification.received', (message) => {
            // Extract clientId from metadata or look up in task registry
            let clientId = null;
            if (message.content && message.content.metadata && message.content.metadata.clientId) {
                // Get clientId directly from message metadata
                clientId = message.content.metadata.clientId;
            }
            else if (message.taskId) {
                // Look up task to find the clientId
                try {
                    const task = this.tasks.getTask(message.taskId);
                    if (task && task.clientId) {
                        clientId = task.clientId;
                    }
                }
                catch (error) {
                    console.error(`Error looking up task for notification: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            // If we found a valid clientId, forward the notification
            if (clientId && typeof clientId === 'string' && this.clientServer.hasClientConnection(clientId)) {
                this.clientServer.forwardTaskNotificationToClient(clientId, message.content);
            }
            else {
                console.warn(`Cannot forward task notification: Invalid or disconnected clientId [${clientId}]`, message);
            }
        });
        // Handle service task results
        this.eventBus.on('service.task.result.received', (message, connectionId, serviceServer) => {
            try {
                // Process the task result
                console.log(`Processing service task result: ${JSON.stringify(message.content)}`);
                // Forward to any agents or clients that need this result
                const serviceTaskId = message.content?.taskId;
                if (serviceTaskId) {
                    const serviceTask = this.serviceTasks.getTask(serviceTaskId);
                    if (serviceTask && serviceTask.agentId) {
                        // Forward to agent
                        const agent = this.agents.getAgentById(serviceTask.agentId);
                        if (agent && agent.connectionId) {
                            this.agentServer.send(agent.connectionId, {
                                id: (0, uuid_1.v4)(),
                                type: 'service.task.result',
                                content: message.content,
                                requestId: message.id
                            });
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error processing service task result:', error);
            }
        });
        // Handle service errors
        this.eventBus.on('service.error.received', (message, connectionId, serviceServer) => {
            try {
                // Log the error
                console.error('Service error received:', message.content);
                // Process the error if needed
                const serviceTaskId = message.content?.taskId;
                if (serviceTaskId) {
                    const serviceTask = this.serviceTasks.getTask(serviceTaskId);
                    if (serviceTask && serviceTask.agentId) {
                        // Forward error to agent
                        const agent = this.agents.getAgentById(serviceTask.agentId);
                        if (agent && agent.connectionId) {
                            this.agentServer.send(agent.connectionId, {
                                id: (0, uuid_1.v4)(),
                                type: 'service.error',
                                content: message.content,
                                requestId: message.id
                            });
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error processing service error:', error);
            }
        });
        // Client registration handler
        this.eventBus.on('client.register', (message, clientId, clientServer) => {
            try {
                const content = message.content || {};
                // Update client in registry with provided information
                const client = this.clients.updateClient({
                    id: clientId,
                    name: content.name,
                    metadata: content.metadata || {},
                    status: 'online'
                });
                // Respond with success
                clientServer.send(clientId, {
                    id: message.id || (0, uuid_1.v4)(),
                    type: 'client.register.response',
                    content: {
                        success: true,
                        client: {
                            id: client.id,
                            name: client.name,
                            status: client.status,
                            registeredAt: client.registeredAt,
                            lastActiveAt: client.lastActiveAt
                        }
                    }
                });
                // Emit event for any other components that need to know
                this.eventBus.emit('client.registered', client);
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error registering client', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client list request handler
        this.eventBus.on('client.list.request', (message, clientId, clientServer) => {
            try {
                const content = message.content || {};
                const filters = content.filters || {};
                // Get client list from registry
                const clients = this.clients.getAllClients(filters);
                // Send response
                clientServer.send(clientId, {
                    id: message.id || (0, uuid_1.v4)(),
                    type: 'client.list.response',
                    content: {
                        clients: clients
                    }
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error getting client list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client task creation request handler
        this.eventBus.on('client.task.create.request', (message, clientId, clientServer) => {
            try {
                // Process task creation through the message handler
                this.messageHandler.handleTaskCreation(message, clientId)
                    .then((result) => {
                    // Send initial task created message
                    clientServer.send(clientId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.created',
                        content: result
                    });
                })
                    .catch((error) => {
                    clientServer.sendError(clientId, 'Error creating task', message.id, error.message);
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error creating task', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client task status request handler
        this.eventBus.on('client.task.status.request', (message, clientId, clientServer) => {
            try {
                const taskId = message.content?.taskId;
                if (!taskId) {
                    return clientServer.sendError(clientId, 'Invalid request', message.id, 'Task ID is required');
                }
                // Get task from registry
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    return clientServer.sendError(clientId, 'Task not found', message.id, `Task ${taskId} not found`);
                }
                // Send task status
                clientServer.send(clientId, {
                    id: message.id || (0, uuid_1.v4)(),
                    type: 'task.status',
                    content: {
                        taskId,
                        status: task.status,
                        agentId: task.agentId,
                        createdAt: task.createdAt,
                        updatedAt: task.updatedAt
                    }
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error getting task status', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client agent list request handler
        this.eventBus.on('client.agent.list.request', (message, clientId, clientServer) => {
            try {
                const filters = message.content?.filters || {};
                // Get agent list from registry
                const agents = this.messageHandler.getAgentList(filters);
                // Send response
                clientServer.send(clientId, {
                    id: message.id || (0, uuid_1.v4)(),
                    type: 'agent.list',
                    content: {
                        agents: agents
                    }
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error getting agent list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client MCP server list request handler
        this.eventBus.on('client.mcp.server.list.request', (message, clientId, clientServer) => {
            try {
                const filters = message.content?.filters || {};
                // Get MCP server list
                const servers = this.mcp.getServerList(filters);
                // Send response
                clientServer.send(clientId, {
                    id: message.id || (0, uuid_1.v4)(),
                    type: 'mcp.server.list',
                    content: {
                        servers: servers
                    }
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error getting MCP server list', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client MCP server tools request handler
        this.eventBus.on('client.mcp.server.tools.request', (message, clientId, clientServer) => {
            try {
                const serverId = message.content?.serverId;
                if (!serverId) {
                    return clientServer.sendError(clientId, 'Invalid request', message.id, 'Server ID is required');
                }
                // Get tools for the server
                const tools = this.mcp.getToolList(serverId);
                // Send response
                clientServer.send(clientId, {
                    id: message.id || (0, uuid_1.v4)(),
                    type: 'mcp.server.tools',
                    content: {
                        serverId,
                        tools
                    }
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error getting MCP server tools', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client MCP tool execution request handler
        this.eventBus.on('client.mcp.tool.execute.request', (message, clientId, clientServer) => {
            try {
                const serverId = message.content?.serverId;
                const toolName = message.content?.toolName;
                const parameters = message.content?.parameters || {};
                if (!serverId || !toolName) {
                    return clientServer.sendError(clientId, 'Invalid request', message.id, 'Server ID and tool name are required');
                }
                // Execute MCP tool
                this.mcp.executeServerTool(serverId, toolName, parameters)
                    .then((result) => {
                    clientServer.send(clientId, {
                        id: message.id || (0, uuid_1.v4)(),
                        type: 'mcp.tool.execution.result',
                        content: {
                            serverId,
                            toolName,
                            status: 'success',
                            result
                        }
                    });
                })
                    .catch((error) => {
                    clientServer.sendError(clientId, 'Error executing MCP tool', message.id, error.message);
                });
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error executing MCP tool', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Client direct message handler
        this.eventBus.on('client.direct.message', (message, clientId, clientServer) => {
            try {
                const targetType = message.content?.target?.type;
                const targetId = message.content?.target?.id;
                if (!targetType || !targetId) {
                    return clientServer.sendError(clientId, 'Invalid target', message.id, 'Target type and ID are required');
                }
                // Enhance message with sender information
                const enhancedMessage = {
                    ...message,
                    content: {
                        ...message.content,
                        sender: {
                            id: clientId,
                            type: 'client'
                        }
                    }
                };
                // Handle different target types
                switch (targetType) {
                    case 'agent':
                        this.eventBus.emit('client.message.agent', enhancedMessage, targetId, (result) => {
                            if (result.error) {
                                clientServer.sendError(clientId, 'Error sending message to agent', message.id, result.error);
                                return;
                            }
                            // Confirm message delivery
                            clientServer.send(clientId, {
                                id: message.id || (0, uuid_1.v4)(),
                                type: 'message.sent',
                                content: {
                                    target: {
                                        type: targetType,
                                        id: targetId
                                    },
                                    result: result
                                }
                            });
                        });
                        break;
                    case 'client':
                        this.eventBus.emit('client.message.client', enhancedMessage, targetId, (result) => {
                            if (result.error) {
                                clientServer.sendError(clientId, 'Error sending message to client', message.id, result.error);
                                return;
                            }
                            // Confirm message delivery
                            clientServer.send(clientId, {
                                id: message.id || (0, uuid_1.v4)(),
                                type: 'message.sent',
                                content: {
                                    target: {
                                        type: targetType,
                                        id: targetId
                                    }
                                }
                            });
                        });
                        break;
                    default:
                        clientServer.sendError(clientId, 'Unsupported target type', message.id, `Target type '${targetType}' is not supported`);
                        break;
                }
            }
            catch (error) {
                clientServer.sendError(clientId, 'Error processing direct message', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Service event handlers
        this.eventBus.on('service.register', (message, connectionId, serviceServer) => {
            try {
                const content = message.content || {};
                if (!content.name) {
                    return serviceServer.sendError(connectionId, 'Service name is required', message.id);
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
                serviceServer.send(connectionId, {
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
                serviceServer.sendError(connectionId, 'Error registering service', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        this.eventBus.on('service.status.update', (message, connectionId, serviceServer) => {
            try {
                const content = message.content || {};
                const { status } = content;
                if (!status) {
                    return serviceServer.sendError(connectionId, 'Status is required', message.id);
                }
                // Get service ID from connection
                const service = this.services.getServiceByConnectionId(connectionId);
                if (!service) {
                    return serviceServer.sendError(connectionId, 'Service not found or not registered', message.id);
                }
                // Update service status
                this.services.updateServiceStatus(service.id, status, content);
                // Respond with confirmation
                serviceServer.send(connectionId, {
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
                serviceServer.sendError(connectionId, 'Error updating service status', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        this.eventBus.on('service.task.notification', (message, connectionId, serviceServer) => {
            try {
                // Get service info
                const serviceId = this.services.getServiceByConnectionId(connectionId)?.id;
                if (!serviceId) {
                    return serviceServer.sendError(connectionId, 'Service not registered or unknown', message.id);
                }
                const service = this.services.getServiceById(serviceId);
                if (!service) {
                    return serviceServer.sendError(connectionId, 'Service not found', message.id);
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
                serviceServer.send(connectionId, {
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
                serviceServer.sendError(connectionId, 'Error processing notification', message.id, error instanceof Error ? error.message : String(error));
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
                    await this.mcp.registerMCPServer({
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
// Create orchestrator instance
const orchestrator = new Orchestrator();
// Start the orchestrator when run directly
if (require.main === module) {
    orchestrator.start()
        .catch(error => {
        console.error('Failed to start orchestrator:', error);
        process.exit(1);
    });
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully');
        try {
            await orchestrator.stop();
            process.exit(0);
        }
        catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully');
        try {
            await orchestrator.stop();
            process.exit(0);
        }
        catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
}
exports.default = orchestrator;
