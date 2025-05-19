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
const agent_registry_1 = require("../agent/agent-registry");
const agent_task_registry_1 = require("./utils/tasks/agent-task-registry");
const service_registry_1 = require("../service/service-registry");
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
// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith('--')) {
                result[key] = nextArg;
                i++; // Skip the value
            }
            else {
                result[key] = true;
            }
        }
    }
    return result;
}
/**
 * Orchestrator - Main coordinator for the Agent Swarm Protocol
 * Manages communication between agents and clients through dedicated servers
 */
class Orchestrator {
    constructor(config = {}) {
        // Check for command-line arguments
        const cliArgs = parseArgs();
        // Apply command-line arguments to config
        if (cliArgs.config && typeof cliArgs.config === 'string') {
            console.log(`Using configuration file from command line: ${cliArgs.config}`);
            config.configPath = cliArgs.config;
        }
        if (cliArgs.agentPort && typeof cliArgs.agentPort === 'string') {
            config.port = parseInt(cliArgs.agentPort, 10);
        }
        if (cliArgs.clientPort && typeof cliArgs.clientPort === 'string') {
            config.clientPort = parseInt(cliArgs.clientPort, 10);
        }
        if (cliArgs.servicePort && typeof cliArgs.servicePort === 'string') {
            config.servicePort = parseInt(cliArgs.servicePort, 10);
        }
        if (cliArgs.logLevel && typeof cliArgs.logLevel === 'string') {
            config.logLevel = cliArgs.logLevel;
        }
        // Load configuration
        this.configLoader = new config_loader_1.default({
            configPath: config.configPath
        });
        // Load and merge configurations
        const loadedConfig = this.configLoader.mergeWithOptions(config);
        const orchestratorSettings = this.configLoader.getOrchestratorSettings();
        this.port = config.port || orchestratorSettings.agentPort || Number(process.env.PORT) || 3000;
        this.clientPort = config.clientPort || orchestratorSettings.clientPort || Number(process.env.CLIENT_PORT) || 3001;
        this.servicePort = config.servicePort || orchestratorSettings.servicePort || Number(process.env.SERVICE_PORT) || 3002;
        this.logLevel = config.logLevel || orchestratorSettings.logLevel || process.env.LOG_LEVEL || 'info';
        this.agents = new agent_registry_1.AgentRegistry();
        this.tasks = new agent_task_registry_1.AgentTaskRegistry();
        this.services = new service_registry_1.ServiceRegistry();
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
            eventBus: this.eventBus,
            mcp: this.mcp
        });
        // Create servers with specific dependencies rather than passing the entire orchestrator
        this.agentServer = new agent_server_1.default({ agents: this.agents }, this.eventBus, { port: this.port }, this.messageHandler);
        this.clientServer = new client_server_1.default(this.eventBus, { clientPort: this.clientPort });
        this.serviceServer = new service_server_1.default({ services: this.services }, this.eventBus, { port: this.servicePort });
        // Set up event listeners
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Listen for task created events
        this.eventBus.on('task.created', (taskId, agentId, clientId, taskData) => {
            console.log(`Task ${taskId} created for agent ${agentId} by client ${clientId}`);
            // Get the agent connection
            const agent = this.agents.getAgentById(agentId);
            if (agent && agent.connectionId) {
                // Check if we have the actual connection object
                const connection = agent.connection;
                if (!connection) {
                    console.error(`Cannot send task ${taskId} to agent ${agentId}: Agent connection not found`);
                    this.tasks.updateTaskStatus(taskId, 'failed', { error: 'Agent connection not found' });
                    return;
                }
                // Create a task message to send to the agent
                const taskMessage = {
                    id: taskId,
                    type: 'task.execute',
                    content: {
                        taskId: taskId,
                        type: taskData.taskType,
                        data: {
                            conversationId: taskData.conversationId,
                            message: taskData.message,
                            role: taskData.role,
                            context: taskData.context
                        }
                    }
                };
                // Send the task to the agent
                try {
                    connection.send(JSON.stringify({
                        ...taskMessage,
                        timestamp: Date.now().toString()
                    }));
                    console.log(`Task ${taskId} sent to agent ${agentId}`);
                }
                catch (error) {
                    console.error(`Error sending task to agent: ${error instanceof Error ? error.message : String(error)}`);
                    this.tasks.updateTaskStatus(taskId, 'failed', { error: 'Failed to send task to agent' });
                }
            }
            else {
                console.error(`Cannot send task ${taskId} to agent ${agentId}: Agent not connected`);
                this.tasks.updateTaskStatus(taskId, 'failed', { error: 'Agent not connected' });
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
                    // Emit general task status event
                    this.eventBus.emit('task.status', message);
                    // Forward the status update to the client if needed
                    const task = this.tasks.getTask(taskId);
                    if (task && task.clientId && typeof task.clientId === 'string') {
                        console.log(`Forwarding task status update to client: ${task.clientId}`);
                        console.log(message.content);
                        // Format the message in a standard way expected by clients
                        this.clientServer.sendMessageToClient(task.clientId, {
                            id: (0, uuid_1.v4)(),
                            type: 'task.status',
                            content: {
                                taskId,
                                status,
                                agentId,
                                result: status === 'completed' ? message.content.result : null,
                                error: status === 'failed' ? message.content.error : null,
                                timestamp: Date.now().toString()
                            }
                        });
                        // If task is completed, also send a separate task.result message
                        // which may be what the UI is looking for
                        if (status === 'completed') {
                            console.log(`Also sending task.result for completed task ${taskId} to client ${task.clientId}`);
                            this.clientServer.sendMessageToClient(task.clientId, {
                                id: (0, uuid_1.v4)(),
                                type: 'task.result',
                                content: {
                                    taskId,
                                    status: 'completed',
                                    result: message.content.result || message.content,
                                    completedAt: new Date().toISOString()
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
        // Listen for service request events
        this.eventBus.on('service.request', async (message, connectionId, callback) => {
            try {
                const result = await this.messageHandler.handleServiceRequest(message, connectionId);
                callback(result);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle service registration
        this.eventBus.on('service.register', async (message, connectionId, callback) => {
            try {
                const result = this.messageHandler.handleServiceRegistration(message, connectionId);
                callback(result);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
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
            this.forwardTaskResultToClient(clientId, taskId, content);
        });
        // Handle service task result forwarding to agent
        this.eventBus.on('service.task.result', (agentId, taskId, content) => {
            this.forwardServiceTaskResultToAgent(agentId, taskId, content);
        });
        // Handle task notifications
        this.eventBus.on('task.notification', (message) => {
            this.forwardTaskNotificationToClient(message);
        });
        // Handle service notifications
        this.eventBus.on('service.notification', (message) => {
            if (message.content && message.content.metadata) {
                const { clientId, agentId } = message.content.metadata;
                // Forward to client if clientId is available
                if (clientId) {
                    this.forwardServiceTaskNotificationToClient(message);
                }
                // Forward to agent if agentId is available
                if (agentId) {
                    this.forwardServiceTaskNotificationToAgent(agentId, message);
                }
            }
        });
        // Handle client agent list requests
        this.eventBus.on('client.agent.list', (filters, callback) => {
            try {
                const agents = this.messageHandler.getAgentList(filters);
                callback(agents);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle client service list requests
        this.eventBus.on('client.service.list', (filters, callback) => {
            try {
                const services = this.services.getAllServices(filters);
                callback(services);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle agent list requests from agents
        this.eventBus.on('agent.list.request', (filters, callback) => {
            try {
                const agents = this.messageHandler.getAgentList(filters);
                callback(agents);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle MCP servers list requests
        this.eventBus.on('mcp.servers.list.request', (filters, callback) => {
            try {
                const servers = this.mcp.getServerList(filters);
                callback(servers);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle MCP tools list requests
        this.eventBus.on('mcp.tools.list.request', (serverId, callback) => {
            try {
                if (!serverId) {
                    callback({ error: 'Server ID is required' });
                    return;
                }
                const tools = this.mcp.getToolList(serverId);
                callback(tools);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle MCP tool execution requests
        this.eventBus.on('mcp.tool.execute.request', (params, callback) => {
            try {
                const { serverId, toolName, parameters, agentId } = params;
                if (!serverId || !toolName) {
                    callback({ error: 'Server ID and tool name are required' });
                    return;
                }
                // Execute the tool
                this.mcp.executeServerTool(serverId, toolName, parameters || {})
                    .then((result) => {
                    callback({
                        serverId,
                        toolName,
                        status: 'success',
                        result
                    });
                })
                    .catch((error) => {
                    callback({
                        serverId,
                        toolName,
                        status: 'error',
                        error: error.message
                    });
                });
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle agent status update requests
        this.eventBus.on('agent.status.update', (message, connectionId, callback) => {
            try {
                const agent = this.agents.getAgentByConnectionId(connectionId);
                if (!agent) {
                    callback({ error: 'Agent not registered or unknown' });
                    return;
                }
                const { status, message: statusMessage } = message.content;
                if (!status) {
                    callback({ error: 'Status is required for status update' });
                    return;
                }
                // Update agent status in the registry
                this.agents.updateAgentStatus(agent.id, status, {
                    message: statusMessage,
                    updatedAt: new Date().toISOString()
                });
                // Notify about success
                callback({
                    agentId: agent.id,
                    status,
                    message: `Agent status updated to ${status}`
                });
                // Emit an event about the status change
                this.eventBus.emit('agent.status.changed', agent.id, status, statusMessage);
                console.log(`Agent ${agent.name} (${agent.id}) status updated to ${status}`);
            }
            catch (error) {
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle client messages to agents
        this.eventBus.on('client.message.agent', async (message, targetAgentId, callback) => {
            try {
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
                            clientId: message.content.sender.id,
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
                    clientId: message.content.sender.id,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    taskData
                });
                // Emit task created event
                this.eventBus.emit('task.created', taskId, targetAgentId, message.content.sender.id, taskData);
                callback({
                    taskId,
                    status: 'pending'
                });
            }
            catch (error) {
                console.error('Error handling client message:', error);
                callback({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Handle task status updates
        this.eventBus.on('task.status', (message) => {
            try {
                if (!message || !message.content) {
                    console.error('Invalid task status message received:', message);
                    return;
                }
                const { taskId, status } = message.content;
                if (!taskId || !status) {
                    console.error('Invalid task status message - missing taskId or status:', message);
                    return;
                }
                console.log(`Received task status update for task ${taskId}: ${status}`);
                // Update task status in registry
                this.tasks.updateTaskStatus(taskId, status, message.content);
                // Handle task completion
                if (status === 'completed') {
                    // Get the task to retrieve the clientId
                    try {
                        const task = this.tasks.getTask(taskId);
                        if (task && task.clientId && typeof task.clientId === 'string') {
                            // Send standardized task.result message for completed tasks
                            console.log(`Task ${taskId} completed - sending result to client ${task.clientId}`);
                            this.clientServer.sendMessageToClient(task.clientId, {
                                id: (0, uuid_1.v4)(),
                                type: 'task.result',
                                content: {
                                    taskId,
                                    status: 'completed',
                                    result: message.content.result || message.content,
                                    completedAt: new Date().toISOString()
                                }
                            });
                        }
                        else if (task && task.clientId) {
                            console.warn(`Task ${taskId} completed but has invalid clientId: ${typeof task.clientId}`);
                        }
                        else {
                            console.warn(`Task ${taskId} completed but has no clientId`);
                        }
                    }
                    catch (error) {
                        console.error(`Error handling completed task ${taskId}:`, error);
                    }
                }
            }
            catch (error) {
                console.error('Error handling task status update:', error);
            }
        });
    }
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
    /**
     * Send a message to a WebSocket connection or to a connection ID and wait for a response
     * @param wsOrConnectionId - WebSocket object or connection ID
     * @param message - Message to send
     * @param options - Send options
     * @returns Promise resolving with the response
     */
    async sendAndWaitForResponse(wsOrConnectionId, message, options = {}) {
        return new Promise((resolve, reject) => {
            let ws;
            // If a connection ID was provided, try to find the WebSocket
            if (typeof wsOrConnectionId === 'string') {
                // Try to find agent connection
                const agent = this.agents.getAgentByConnectionId(wsOrConnectionId);
                if (agent && agent.connection) {
                    ws = agent.connection;
                }
                else {
                    // If not an agent, check if it's a service
                    const service = this.services.getServiceByConnectionId(wsOrConnectionId);
                    if (service && service.connection) {
                        ws = service.connection;
                    }
                    else {
                        return reject(new Error(`Connection not found for ID: ${wsOrConnectionId}`));
                    }
                }
            }
            else {
                // WebSocket object was directly provided
                ws = wsOrConnectionId;
            }
            const messageId = message.id || (0, uuid_1.v4)();
            // Ensure message has an ID
            if (!message.id) {
                message.id = messageId;
            }
            // Add timestamp if not present
            if (!message.timestamp) {
                message.timestamp = Date.now().toString();
            }
            // Convert message to string
            const messageString = JSON.stringify(message);
            // Set up timeout for response
            const timeout = options.timeout || 30000; // Default 30 seconds timeout
            const timer = setTimeout(() => {
                if (this.pendingResponses[messageId]) {
                    delete this.pendingResponses[messageId];
                    reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
                }
            }, timeout);
            // Store the handlers
            this.pendingResponses[messageId] = {
                resolve,
                reject,
                timer
            };
            // Send the message
            try {
                ws.send(messageString, (error) => {
                    if (error) {
                        clearTimeout(timer);
                        delete this.pendingResponses[messageId];
                        reject(error);
                    }
                });
            }
            catch (error) {
                clearTimeout(timer);
                delete this.pendingResponses[messageId];
                reject(error);
            }
        });
    }
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
     * Forward task result to client
     */
    forwardTaskResultToClient(clientId, taskId, content) {
        if (!clientId || typeof clientId !== 'string') {
            console.error(`Cannot forward task result: Invalid client ID [${clientId}]`);
            return;
        }
        try {
            // Format the message in a consistent way for the UI
            console.log(`Forwarding task result to client ${clientId} for task ${taskId}`);
            // Create a properly formatted task result message that matches TaskResultMessage interface
            const resultMessage = {
                id: (0, uuid_1.v4)(),
                type: 'task.result',
                content: {
                    taskId,
                    status: 'completed',
                    result: content.result || content,
                    completedAt: new Date().toISOString()
                }
            };
            console.log(`Task result message: ${JSON.stringify(resultMessage)}`);
            this.clientServer.sendMessageToClient(clientId, resultMessage);
        }
        catch (error) {
            console.error(`Error forwarding task result to client ${clientId}:`, error);
        }
    }
    /**
     * Forward service task result to agent
     */
    forwardServiceTaskResultToAgent(agentId, taskId, content) {
        const agent = this.agents.getAgentById(agentId);
        if (agent && agent.connectionId && agent.connection) {
            const connection = agent.connection;
            try {
                connection.send(JSON.stringify({
                    id: (0, uuid_1.v4)(),
                    type: 'service.task.result',
                    taskId,
                    content,
                    timestamp: Date.now().toString()
                }));
            }
            catch (error) {
                console.error(`Error forwarding service task result to agent ${agentId}:`, error);
            }
        }
        else {
            console.error(`Cannot forward service task result to agent ${agentId}: Agent not connected or connection not available`);
        }
    }
    /**
     * Forward task error to client
     */
    forwardTaskErrorToClient(clientId, message) {
        if (!clientId || typeof clientId !== 'string') {
            console.error(`Cannot forward task error: Invalid client ID [${clientId}]`);
            return;
        }
        try {
            this.clientServer.sendMessageToClient(clientId, message);
        }
        catch (error) {
            console.error(`Error forwarding task error to client ${clientId}:`, error);
        }
    }
    /**
     * Forward task notification to client
     */
    forwardTaskNotificationToClient(message) {
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
        // Check if clientId is valid
        if (!clientId || typeof clientId !== 'string') {
            console.warn(`Cannot forward task notification: Invalid clientId [${clientId}]`, message);
            return;
        }
        try {
            // Create notification message for client
            const notificationMessage = {
                id: (0, uuid_1.v4)(),
                type: 'task.notification',
                taskId: message.taskId,
                content: message.content
            };
            // Send notification to client
            this.clientServer.sendMessageToClient(clientId, notificationMessage);
        }
        catch (error) {
            console.error(`Error forwarding notification to client ${clientId}:`, error);
        }
    }
    /**
     * Forward service task notification to client
     */
    forwardServiceTaskNotificationToClient(message) {
        // Extract clientId from metadata or look up in task registry
        let clientId = null;
        if (message.content && message.content.metadata && message.content.metadata.clientId) {
            // Get clientId directly from message metadata
            clientId = message.content.metadata.clientId;
        }
        else if (message.taskId) {
            // Look up task to find the clientId
            try {
                const task = this.serviceTasks.getTask(message.taskId);
                if (task && task.clientId) {
                    clientId = task.clientId;
                }
            }
            catch (error) {
                console.error(`Error looking up service task for notification: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        // Check if clientId is valid
        if (!clientId || typeof clientId !== 'string') {
            console.warn(`Cannot forward service notification to client: Invalid clientId [${clientId}]`, message);
            return;
        }
        try {
            // Create notification message for client
            const notificationMessage = {
                id: (0, uuid_1.v4)(),
                type: 'service.notification',
                taskId: message.taskId,
                content: message.content
            };
            // Send notification to client
            this.clientServer.sendMessageToClient(clientId, notificationMessage);
        }
        catch (error) {
            console.error(`Error forwarding service notification to client ${clientId}:`, error);
        }
    }
    /**
     * Forward service task notification to agent
     */
    forwardServiceTaskNotificationToAgent(agentId, message) {
        const agent = this.agents.getAgentById(agentId);
        if (agent && agent.connectionId && agent.connection) {
            const connection = agent.connection;
            try {
                // Create notification message for agent
                const notificationMessage = {
                    id: (0, uuid_1.v4)(),
                    type: 'service.notification',
                    taskId: message.taskId,
                    content: message.content,
                    timestamp: Date.now().toString()
                };
                // Send notification to agent
                connection.send(JSON.stringify(notificationMessage));
            }
            catch (error) {
                console.warn(`Error forwarding service notification to agent ${agentId}:`, error);
            }
        }
        else {
            console.warn(`Cannot forward service notification to agent ${agentId}: Agent not connected or connection not available`);
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
