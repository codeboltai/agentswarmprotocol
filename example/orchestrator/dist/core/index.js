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
const logger_1 = require("./utils/logger");
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
        // Configure logger
        logger_1.logger.setLogLevel(this.logLevel);
        this.agents = new agent_registry_1.AgentRegistry();
        this.tasks = new agent_task_registry_1.AgentTaskRegistry();
        this.services = new service_registry_1.ServiceRegistry();
        this.clients = new client_registry_1.ClientRegistry();
        this.serviceTasks = new service_task_registry_1.ServiceTaskRegistry();
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
    // Helper method to propagate messages up the task chain to find the ultimate client
    propagateMessageUpTaskChain(task, taskMessage, originAgentId) {
        try {
            // Base case: no more parent tasks
            if (!task || !task.requestingAgentId) {
                return;
            }
            const currentAgent = this.agents.getAgentById(task.agentId);
            const requestingAgent = this.agents.getAgentById(task.requestingAgentId);
            if (!requestingAgent) {
                return;
            }
            // Track which clients we've already sent messages to (to avoid duplicates)
            const notifiedClientIds = new Set();
            // Get the requesting agent's tasks
            const parentTasks = this.tasks.getTasksByAgentIdForChildTasks(requestingAgent.id);
            // Filter tasks with clients
            const clientTasks = parentTasks.filter((t) => t.clientId && !notifiedClientIds.has(t.clientId));
            // If we found at least one client task, send only to the first one
            if (clientTasks.length > 0) {
                const clientTask = clientTasks[0];
                if (clientTask.clientId) {
                    this.clientServer.forwardTaskNotificationToClient(clientTask.clientId, {
                        taskId: clientTask.taskId,
                        childTaskId: task.taskId,
                        agentId: originAgentId || task.agentId,
                        childAgentName: currentAgent?.name || "Unknown",
                        parentAgentName: requestingAgent.name,
                        message: taskMessage,
                        timestamp: new Date().toISOString(),
                        isChildAgentMessage: true
                    });
                    logger_1.logger.orchestratorToClient(`Forwarded child agent message to ancestor client`, {
                        childTaskId: task.taskId,
                        parentTaskId: clientTask.taskId,
                        parentAgentId: requestingAgent.id,
                        clientId: clientTask.clientId
                    }, clientTask.clientId);
                    // Mark this client as notified
                    notifiedClientIds.add(clientTask.clientId);
                    // Return early - we've sent the message to one client
                    return;
                }
            }
            // If no client tasks found, continue up the chain with a single parent task
            // (We don't need to try all paths, just one that might lead to a client)
            const nonClientTasks = parentTasks.filter((t) => !t.clientId && t.requestingAgentId);
            if (nonClientTasks.length > 0) {
                // Pick the first task to continue up the chain
                this.propagateMessageUpTaskChain(nonClientTasks[0], taskMessage, originAgentId || task.agentId);
            }
        }
        catch (error) {
            logger_1.logger.error(logger_1.MessageDirection.ORCHESTRATOR_TO_CLIENT, `Error propagating message up task chain: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    //OK
    setupEventListeners() {
        // IMPORTANT NOTE: When adding or modifying event handlers, ensure:
        // 1. Event names are unique and specific
        // 2. Parameter counts match between emitter and listener
        // 3. All emitters include proper error handling
        // Handle agent registration - add new event handler for agent.register
        this.eventBus.on('agent.register', (message, connectionId) => {
            try {
                const result = this.agentServer.handleAgentRegistration(message, connectionId);
                if (result.error) {
                    this.agentServer.sendError(connectionId, result.error, message.id);
                    return;
                }
                // Send registration confirmation to the agent
                this.agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.registered',
                    content: result,
                    requestId: message.id
                });
                // Send notification to all clients about the new agent
                this.clientServer.broadcastNotification('agent', `New agent "${result.name}" has joined the swarm`, {
                    agentId: result.agentId,
                    agentName: result.name,
                    capabilities: result.capabilities,
                    status: 'online',
                    registeredAt: new Date().toISOString()
                });
                logger_1.logger.orchestratorToClient(`Agent registration notification sent to all clients`, { agentName: result.name, agentId: result.agentId });
            }
            catch (error) {
                this.agentServer.sendError(connectionId, 'Error during agent registration: ' + (error instanceof Error ? error.message : String(error)), message.id);
            }
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
        this.eventBus.on('agent.service.list.request', (message, connectionId) => {
            try {
                const filters = message.content?.filters || {};
                const serviceList = this.services.getAllServices(filters).map(service => ({
                    id: service.id,
                    name: service.name,
                    status: service.status,
                    capabilities: service.capabilities
                }));
                // Send response back to the agent
                this.agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.service.list.response',
                    content: {
                        services: serviceList
                    },
                    requestId: message.id
                });
                logger_1.logger.orchestratorToAgent(`Service list sent to agent (${serviceList.length} services)`, { serviceCount: serviceList.length }, connectionId);
            }
            catch (error) {
                this.agentServer.sendError(connectionId, 'Error getting service list: ' + (error instanceof Error ? error.message : String(error)), message.id);
            }
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
        this.eventBus.on('client.agent.task.create.request', async (message, clientId) => {
            try {
                const { agentName, agentId, taskData } = message.content;
                logger_1.logger.clientToOrchestrator(`Task creation request received`, {
                    agentName,
                    agentId,
                    hasTaskData: !!taskData,
                    taskDataType: taskData ? typeof taskData : 'undefined',
                    taskDataKeys: taskData && typeof taskData === 'object' ? Object.keys(taskData) : []
                }, clientId);
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
                    type: 'client.task',
                    name: `Client task for ${agent.name}`,
                    severity: 'normal',
                    agentId: agent.id,
                    clientId: clientId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData,
                    requestId: message.id
                });
                // Get the agent connection and send task directly
                const connection = this.agents.getConnectionByAgentId(agent.id);
                if (!connection) {
                    // Update task status to failed
                    this.tasks.updateTaskStatus(taskId, 'failed', {
                        error: 'Agent connection not found',
                        metadata: { failedAt: new Date().toISOString() }
                    });
                    throw new Error('Cannot deliver task to agent: not connected');
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
                // Send the task to the agent - use connectionId instead of connection object
                this.agentServer.send(connection.id, taskMessage);
                logger_1.logger.orchestratorToAgent(`Task sent to agent`, { taskId }, agent.id);
                // Update task status to running
                this.tasks.updateTaskStatus(taskId, 'running', {
                    metadata: { startedAt: new Date().toISOString() }
                });
                // Send response to client
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'client.agent.task.create.response',
                    content: {
                        taskId,
                        agentId: agent.id,
                        agentName: agent.name,
                        status: 'running'
                    },
                    requestId: message.id
                });
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error creating task', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // Listen for client agent task status requests
        this.eventBus.on('client.agent.task.status.request', (message, clientId) => {
            try {
                const { taskId } = message.content;
                if (!taskId) {
                    this.clientServer.sendError(clientId, 'Task ID is required', message.id);
                    return;
                }
                // Get the task from the task registry
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    this.clientServer.sendError(clientId, `Task ${taskId} not found`, message.id);
                    return;
                }
                // Send task status response to client
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'client.agent.task.status.response',
                    content: {
                        taskId: task.taskId || taskId,
                        status: task.status,
                        agentId: task.agentId,
                        type: task.type,
                        name: task.name,
                        severity: task.severity,
                        createdAt: task.createdAt,
                        completedAt: task.completedAt,
                        result: task.result,
                        error: task.error,
                        metadata: task.metadata
                    },
                    requestId: message.id
                });
                logger_1.logger.orchestratorToClient(`Task status sent to client`, { taskId, status: task.status }, clientId);
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error getting task status', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // // Listen for client MCP server list requests
        // this.eventBus.on('client.mcp.server.list', (filters: any, requestId?: string) => {
        //   this.messageHandler.handleClientMCPServerListRequest(filters, requestId);
        // });
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
                const sendResult = this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'task.message.sent',
                    content: {
                        taskId,
                        status: 'sent'
                    },
                    requestId: message.id
                });
                if (sendResult === false) {
                    logger_1.logger.error(logger_1.MessageDirection.ORCHESTRATOR_TO_CLIENT, `Could not send confirmation to client - not connected`, undefined, clientId);
                }
            }
            catch (error) {
                this.clientServer.sendError(clientId, 'Error sending task message', message.id, error instanceof Error ? error.message : String(error));
            }
        });
        // NEW: Handle task.message events from agents (not clients)
        this.eventBus.on('agent.task.message', (message, connectionId) => {
            try {
                const { agentId, taskId, message: taskMessage } = message.content;
                if (!taskId) {
                    this.agentServer.sendError(connectionId, 'Task ID is required for task message', message.id);
                    return;
                }
                // Get the task to find the client
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    this.agentServer.sendError(connectionId, `Task ${taskId} not found`, message.id);
                    return;
                }
                // Track which clients we've already sent messages to
                const notifiedClientIds = new Set();
                // If this task has a client ID associated with it, forward the message to the client
                if (task.clientId) {
                    this.clientServer.forwardTaskNotificationToClient(task.clientId, {
                        taskId,
                        agentId: agentId || task.agentId,
                        message: taskMessage,
                        timestamp: new Date().toISOString()
                    });
                    // Mark this client as notified
                    notifiedClientIds.add(task.clientId);
                }
                // If this is a child task, find the requesting agent's client and forward the message
                // (but only if we haven't already sent to this client)
                if (task.requestingAgentId) {
                    const requestingAgent = this.agents.getAgentById(task.requestingAgentId);
                    if (requestingAgent) {
                        // Get the requesting agent's task to find its client
                        const parentTasks = this.tasks.getTasksByAgentId(requestingAgent.id);
                        // Get all parent tasks that have clients (including client tasks and parent tasks from other agents)
                        // but only those we haven't notified yet
                        const parentClientTasks = parentTasks.filter((parentTask) => parentTask.clientId && !notifiedClientIds.has(parentTask.clientId));
                        if (parentClientTasks.length > 0) {
                            // Forward the message to only the first client of the requesting agent
                            // to avoid duplicate messages
                            const parentTask = parentClientTasks[0];
                            if (parentTask.clientId) {
                                // Log the forwarding for debugging
                                logger_1.logger.orchestratorToClient(`Forwarding child agent message to parent client`, {
                                    childTaskId: taskId,
                                    parentTaskId: parentTask.taskId,
                                    childAgentId: task.agentId,
                                    parentAgentId: requestingAgent.id,
                                    clientId: parentTask.clientId
                                }, parentTask.clientId);
                                this.clientServer.forwardTaskNotificationToClient(parentTask.clientId, {
                                    taskId: parentTask.taskId, // Use parent task ID for client context
                                    childTaskId: taskId, // Include child task ID
                                    agentId: agentId || task.agentId,
                                    childAgentName: this.agents.getAgentById(task.agentId)?.name || "Unknown",
                                    parentAgentName: requestingAgent.name,
                                    message: taskMessage,
                                    timestamp: new Date().toISOString(),
                                    isChildAgentMessage: true
                                });
                                // Mark this client as notified
                                notifiedClientIds.add(parentTask.clientId);
                            }
                        }
                        else if (notifiedClientIds.size === 0) {
                            // Only try to propagate up the chain if we haven't sent any messages yet
                            // Handle case where no direct client tasks are found
                            // Try to find parent task's parent tasks (chain upward)
                            this.propagateMessageUpTaskChain(task, taskMessage, agentId);
                        }
                    }
                }
                // Send confirmation back to the agent
                try {
                    this.agentServer.send(connectionId, {
                        id: (0, uuid_1.v4)(),
                        type: 'task.message.received',
                        content: {
                            taskId,
                            status: 'received'
                        },
                        requestId: message.id
                    });
                }
                catch (sendError) {
                    logger_1.logger.error(logger_1.MessageDirection.ORCHESTRATOR_TO_AGENT, `Could not send confirmation to agent - not connected`, undefined, connectionId);
                }
            }
            catch (error) {
                this.agentServer.sendError(connectionId, 'Error processing agent task message', message.id);
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
                    },
                    requestId: message.id
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
                // Get target agent connection ID and send task directly
                const targetConnectionId = this.agents.getConnectionIdByAgentId(targetAgent.id);
                if (!targetConnectionId) {
                    // Update task status to failed
                    this.tasks.updateTaskStatus(childTaskId, 'failed', {
                        error: 'Target agent connection not found',
                        metadata: { failedAt: new Date().toISOString() }
                    });
                    // Notify requesting agent of failure
                    this.agentServer.send(connectionId, {
                        id: (0, uuid_1.v4)(),
                        type: 'childagent.response',
                        content: {
                            childTaskId,
                            error: 'Target agent not connected',
                            status: 'failed'
                        }
                    });
                    return;
                }
                // Create a task message to send to the target agent
                const taskMessage = {
                    id: childTaskId,
                    type: 'task.execute',
                    content: {
                        taskId: childTaskId,
                        type: taskType,
                        data: {
                            taskType,
                            ...taskData,
                            metadata: {
                                requestingAgent: {
                                    id: requestingAgent.id,
                                    name: requestingAgent.name
                                }
                            }
                        }
                    }
                };
                // Send the task to the target agent
                this.agentServer.send(targetConnectionId, taskMessage);
                logger_1.logger.agentToAgent(`Child task sent`, { childTaskId }, requestingAgent.id, targetAgent.id);
                // Update task status to running
                this.tasks.updateTaskStatus(childTaskId, 'running', {
                    metadata: { startedAt: new Date().toISOString() }
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
                // Get tools for the service
                const tools = this.services.getServiceTools(serviceId);
                this.agentServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.tools.list.response',
                    content: {
                        serviceId,
                        serviceName: service.name,
                        tools
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
                const { serviceId, toolId, toolName, params, clientId } = message.content;
                if (!serviceId || (!toolId && !toolName)) {
                    this.agentServer.sendError(connectionId, 'Service ID and tool ID (or tool name) are required', message.id);
                    return;
                }
                // Use toolId if provided, otherwise fall back to toolName for backward compatibility
                const actualToolId = toolId || toolName;
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
                // Get tool information for better naming
                const tool = service.tools?.find(t => t.id === actualToolId);
                const displayName = tool ? tool.name : actualToolId;
                // Register the service task
                this.serviceTasks.registerTask(serviceTaskId, {
                    type: 'service.task',
                    name: `Service task: ${displayName}`,
                    severity: 'normal',
                    serviceId: service.id,
                    agentId: requestingAgent?.id,
                    clientId: clientId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData: {
                        toolId: actualToolId,
                        functionName: actualToolId, // Keep for backward compatibility
                        params: params || {},
                        metadata: {
                            agentId: requestingAgent?.id,
                            clientId: clientId,
                            timestamp: new Date().toISOString()
                        }
                    },
                    requestId: message.id
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
                            toolId: actualToolId,
                            toolName: displayName,
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
                        toolId: actualToolId,
                        functionName: actualToolId, // Keep for backward compatibility
                        params: params || {},
                        metadata: {
                            agentId: requestingAgent?.id,
                            clientId: clientId,
                            timestamp: new Date().toISOString()
                        }
                    }
                });
                // Don't send immediate acceptance response - wait for the actual result
                // The result will be sent when the service completes the task
            }
            catch (error) {
                this.agentServer.sendError(connectionId, `Error executing service task: ${error instanceof Error ? error.message : String(error)}`, message.id);
            }
        });
        // Listen for service registration events
        this.eventBus.on('service.register', (message, connectionId) => {
            try {
                const content = message.content || {};
                if (!content.name) {
                    return this.serviceServer.sendError(connectionId, 'Service name is required', message.id);
                }
                // Use provided serviceId or generate one
                const serviceId = content.id || (0, uuid_1.v4)();
                // Check if this is a reconnection of an existing service
                const existingService = this.services.getServiceById(serviceId);
                const service = {
                    id: serviceId,
                    name: content.name,
                    type: content.type || 'service',
                    capabilities: content.capabilities || [],
                    tools: content.tools || [], // Include tools from registration
                    status: 'online',
                    connectionId, // Include the connectionId in the service object
                    registeredAt: existingService ? existingService.registeredAt : new Date().toISOString(),
                    metadata: content.metadata || {}
                };
                // Register in registry - this will update existing service or create new one
                this.services.registerService(service);
                // Respond with confirmation
                this.serviceServer.send(connectionId, {
                    id: (0, uuid_1.v4)(),
                    type: 'service.registered',
                    content: {
                        id: serviceId,
                        name: service.name,
                        status: service.status,
                        message: existingService ? 'Service reconnected successfully' : 'Service successfully registered'
                    },
                    requestId: message.id
                });
                logger_1.logger.serviceToOrchestrator(`Service ${existingService ? 'reconnected' : 'registered'} successfully`, { serviceName: service.name }, serviceId);
            }
            catch (error) {
                this.serviceServer.sendError(connectionId, 'Error during service registration: ' + (error instanceof Error ? error.message : String(error)), message.id);
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
                logger_1.logger.serviceToOrchestrator(`Service status updated`, { serviceName: service.name, status }, service.id);
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
                logger_1.logger.serviceToOrchestrator(`Processing service notification`, { serviceName: service.name }, serviceId);
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
        this.eventBus.on('mcp.tool.execute', async (message, clientIdOrRequestId) => {
            try {
                // Handle both old format (MCPExecuteToolMessage, requestId?: string) 
                // and new format (message: any, clientId: string)
                const serverId = message.serverId || message.content?.serverId;
                const toolName = message.toolName || message.content?.toolName;
                const parameters = message.toolArgs || message.parameters || message.content?.parameters || {};
                if (!serverId || !toolName) {
                    // If this is from an agent (has message.id), send error back to agent
                    if (message.id && clientIdOrRequestId) {
                        this.agentServer.sendError(clientIdOrRequestId, 'Server ID and tool name are required', message.id);
                        return;
                    }
                    // Otherwise emit error to event bus
                    this.eventBus.emit('mcp.tool.execute.error', {
                        serverId,
                        toolName,
                        status: 'error',
                        error: 'Server ID and tool name are required'
                    }, clientIdOrRequestId);
                    return;
                }
                const result = await this.mcpAdapter.executeMCPTool(serverId, toolName, parameters);
                // If this is from an agent (has message.id), send response back to agent
                if (message.id && clientIdOrRequestId) {
                    this.agentServer.send(clientIdOrRequestId, {
                        id: (0, uuid_1.v4)(),
                        type: 'mcp.tool.execute.result',
                        content: {
                            serverId,
                            toolName,
                            result,
                            status: 'success'
                        },
                        requestId: message.id
                    });
                }
                else {
                    // Otherwise emit result to event bus
                    this.eventBus.emit('mcp.tool.execute.result', {
                        serverId,
                        toolName,
                        result,
                        status: 'success'
                    }, clientIdOrRequestId);
                }
            }
            catch (error) {
                // If this is from an agent (has message.id), send error back to agent
                if (message.id && clientIdOrRequestId) {
                    this.agentServer.sendError(clientIdOrRequestId, `Error executing MCP tool: ${error instanceof Error ? error.message : String(error)}`, message.id);
                }
                else {
                    // Otherwise emit error to event bus
                    this.eventBus.emit('mcp.tool.execute.error', {
                        serverId: message.serverId || message.content?.serverId,
                        toolName: message.toolName || message.content?.toolName,
                        status: 'error',
                        error: error.message
                    }, clientIdOrRequestId);
                }
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
        this.eventBus.on('mcp.tools.list', async (message, clientIdOrRequestId) => {
            try {
                // Handle both old format (message: { serverId: string }, requestId?: string) 
                // and new format (message: any, clientId: string)
                const serverId = message.serverId || message.content?.serverId;
                if (!serverId) {
                    // If this is from an agent (has message.id), send error back to agent
                    if (message.id && clientIdOrRequestId) {
                        this.agentServer.sendError(clientIdOrRequestId, 'Server ID is required', message.id);
                        return;
                    }
                    // Otherwise emit error to event bus
                    this.eventBus.emit('mcp.tool.list.error', { error: 'Server ID is required' }, clientIdOrRequestId);
                    return;
                }
                const result = await this.mcpAdapter.listMCPTools(serverId);
                // If this is from an agent (has message.id), send response back to agent
                if (message.id && clientIdOrRequestId) {
                    const servers = this.mcpAdapter.listMCPServers();
                    const serverInfo = servers.find((server) => server.id === serverId);
                    this.agentServer.send(clientIdOrRequestId, {
                        id: (0, uuid_1.v4)(),
                        type: 'mcp.tools.list.result',
                        content: {
                            serverId,
                            serverName: serverInfo?.name || 'unknown',
                            tools: result
                        },
                        requestId: message.id
                    });
                }
                else {
                    // Otherwise emit result to event bus
                    this.eventBus.emit('mcp.tool.list.result', {
                        serverId,
                        tools: result
                    }, clientIdOrRequestId);
                }
            }
            catch (error) {
                // If this is from an agent (has message.id), send error back to agent
                if (message.id && clientIdOrRequestId) {
                    this.agentServer.sendError(clientIdOrRequestId, `Error getting MCP tools list: ${error instanceof Error ? error.message : String(error)}`, message.id);
                }
                else {
                    // Otherwise emit error to event bus
                    this.eventBus.emit('mcp.tool.list.error', { error: error.message }, clientIdOrRequestId);
                }
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
        this.eventBus.on('agent.mcp.servers.list', (message, clientId) => {
            try {
                const servers = this.mcpAdapter.listMCPServers();
                this.agentServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.mcp.servers.list.result',
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
        // this.eventBus.on('agent.mcp.servers.list', (message: { filters?: MCPServerFilters }, requestId?: string) => {
        //   try {
        //     const servers = this.mcpAdapter.listMCPServers(message.filters || {});
        //     this.eventBus.emit('agent.mcp.servers.list.result', {
        //       servers
        //     }, requestId);
        //   } catch (error) {
        //     this.eventBus.emit('agent.mcp.servers.list.error', { error: (error as Error).message }, requestId);
        //   }
        // });
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
        // NEW: Handle task completion events
        this.eventBus.on('agent.task.result.received', (message, connectionId) => {
            try {
                const { taskId, result } = message.content;
                if (!taskId) {
                    logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'Task result received without task ID', message, connectionId);
                    return;
                }
                // Get the task
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, `Task ${taskId} not found for result`, { taskId }, connectionId);
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
                        requestId: task.requestId,
                        type: 'client.agent.task.result',
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
                logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'Error handling task result', error, connectionId);
            }
        });
        // NEW: Handle task error events
        this.eventBus.on('task.error', (message, connectionId) => {
            try {
                const { taskId, error } = message.content;
                if (!taskId) {
                    logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'Task error received without task ID', message, connectionId);
                    return;
                }
                // Get the task
                const task = this.tasks.getTask(taskId);
                if (!task) {
                    logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, `Task ${taskId} not found for error`, { taskId }, connectionId);
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
                logger_1.logger.error(logger_1.MessageDirection.AGENT_TO_ORCHESTRATOR, 'Error handling task error', error, connectionId);
            }
        });
        // NEW: Handle service task notifications
        this.eventBus.on('service.task.notification', (message, connectionId) => {
            try {
                const { serviceId, taskId, notification } = message.content;
                // Get the service task
                const serviceTask = this.serviceTasks.getTask(taskId);
                if (!serviceTask) {
                    logger_1.logger.error(logger_1.MessageDirection.SERVICE_TO_ORCHESTRATOR, `Service task ${taskId} not found for notification`, { taskId }, connectionId);
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
                logger_1.logger.error(logger_1.MessageDirection.SERVICE_TO_ORCHESTRATOR, 'Error handling service task notification', error, connectionId);
            }
        });
        // NEW: Handle service task results
        this.eventBus.on('service.task.result.received', (message, connectionId) => {
            try {
                const { taskId, result } = message.content;
                if (!taskId) {
                    logger_1.logger.error(logger_1.MessageDirection.SERVICE_TO_ORCHESTRATOR, 'Service task result received without task ID', message, connectionId);
                    return;
                }
                // Get the service task
                const serviceTask = this.serviceTasks.getTask(taskId);
                if (!serviceTask) {
                    logger_1.logger.error(logger_1.MessageDirection.SERVICE_TO_ORCHESTRATOR, `Service task ${taskId} not found for result`, { taskId }, connectionId);
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
                            type: 'service.task.execute.response',
                            content: {
                                serviceTaskId: taskId,
                                serviceId: serviceTask.serviceId,
                                result,
                                status: 'completed'
                            },
                            requestId: serviceTask.requestId // Include the original request ID for proper response handling
                        });
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(logger_1.MessageDirection.SERVICE_TO_ORCHESTRATOR, 'Error handling service task result', error, connectionId);
            }
        });
        // NEW: Handle missing client events that are emitted but not handled
        // Handle client agent list requests
        this.eventBus.on('client.agent.list.request', (message, clientId, clientServer) => {
            try {
                const filters = message.content?.filters || {};
                const agents = this.agents.getAllAgents();
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'client.agent.list.response',
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
        // Handle agent agent list requests
        this.eventBus.on('agent.agent.list.request', (message, clientId, clientServer) => {
            try {
                const filters = message.content?.filters || {};
                const agents = this.agents.getAllAgents();
                this.agentServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'agent.agent.list.response',
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
                const servers = this.mcpAdapter.listMCPServers();
                this.clientServer.send(clientId, {
                    id: (0, uuid_1.v4)(),
                    type: 'client.mcp.server.list.response',
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
        this.eventBus.on('client.mcp.server.tools.request', async (message, clientId) => {
            try {
                const { serverId } = message.content;
                if (!serverId) {
                    this.clientServer.sendError(clientId, 'Server ID is required', message.id);
                    return;
                }
                const tools = await this.mcpAdapter.listMCPTools(serverId);
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
            logger_1.logger.system(`Starting Agent Swarm Protocol Orchestrator (${this.logLevel} mode)`);
            // Start the WebSocket servers
            await this.agentServer.start();
            logger_1.logger.system(`Agent server started on port ${this.port}`);
            await this.clientServer.start();
            logger_1.logger.system(`Client server started on port ${this.clientPort}`);
            await this.serviceServer.start();
            logger_1.logger.system(`Service server started on port ${this.servicePort}`);
            // Initialize components from config if available
            await this.initMCPServersFromConfig();
            await this.initAgentsFromConfig();
            await this.initServicesFromConfig();
            logger_1.logger.system('Orchestrator ready!');
        }
        catch (error) {
            logger_1.logger.error(logger_1.MessageDirection.SYSTEM, 'Failed to start orchestrator', error);
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
                    const registrationResult = await this.mcpAdapter.registerMCPServer({
                        id: serverConfig.id || (0, uuid_1.v4)(),
                        name: serverConfig.name,
                        type: serverConfig.type || 'node',
                        capabilities: serverConfig.capabilities || [],
                        path: serverConfig.path,
                        command: serverConfig.command,
                        args: serverConfig.args,
                        metadata: serverConfig.metadata || {}
                    });
                    logger_1.logger.mcp(`Registered MCP server: ${serverConfig.name}`);
                    // Connect to the server after registration
                    try {
                        await this.mcpAdapter.connectToMCPServer(registrationResult.serverId);
                        logger_1.logger.mcp(`Connected to MCP server: ${serverConfig.name}`);
                    }
                    catch (connectError) {
                        logger_1.logger.error(logger_1.MessageDirection.MCP, `Failed to connect to MCP server ${serverConfig.name}`, connectError);
                    }
                }
                catch (error) {
                    logger_1.logger.error(logger_1.MessageDirection.MCP, `Failed to register MCP server ${serverConfig.name}`, error);
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
            logger_1.logger.system(`Loaded ${Object.keys(agentConfigs).length} agent configurations`);
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
            logger_1.logger.system(`Loaded ${Object.keys(serviceConfigs).length} service configurations`);
            for (const [serviceName, config] of Object.entries(serviceConfigs)) {
                // This just preloads the configurations, services still need to connect
                this.services.setServiceConfiguration(serviceName, config);
            }
        }
    }
    /**
     * Stop the orchestrator and all its servers
     */
    async stop() {
        try {
            logger_1.logger.system('Stopping Orchestrator...');
            // Stop all servers
            await this.agentServer.stop();
            await this.clientServer.stop();
            await this.serviceServer.stop();
            logger_1.logger.system('Orchestrator stopped.');
        }
        catch (error) {
            logger_1.logger.error(logger_1.MessageDirection.SYSTEM, 'Error stopping orchestrator', error);
            throw error;
        }
    }
}
exports.Orchestrator = Orchestrator;
// Create and export singleton orchestrator instance
const orchestrator = new Orchestrator();
exports.default = orchestrator;
