import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { AgentRegistry } from '../registry/agent-registry';
import { AgentTaskRegistry } from './utils/tasks/agent-task-registry';
import { ServiceRegistry } from '../registry/service-registry';
import { ClientRegistry } from '../registry/client-registry';
import { ServiceTaskRegistry } from './utils/tasks/service-task-registry';
import AgentServer from '../agent/agent-server';
import ClientServer from '../client/client-server';
import ServiceServer from '../service/service-server';
import MessageHandler from './message-handler';
import * as mcp from './utils/mcp';
import ConfigLoader from './utils/config-loader';
import dotenv from 'dotenv';
import {
  OrchestratorConfig,
  PendingResponse,
  WebSocketWithId,
  SendOptions,
  TaskStatus,
  ServiceStatus
} from '@agentswarmprotocol/types/dist/common';

// Load environment variables
dotenv.config({ path: '../.env' });

/**
 * Orchestrator - Main coordinator for the Agent Swarm Protocol
 * Manages communication between agents and clients through dedicated servers
 */
class Orchestrator {
  private port: number;
  private clientPort: number;
  private servicePort: number;
  private logLevel: string;
  private agents: AgentRegistry;
  private tasks: AgentTaskRegistry;
  private services: ServiceRegistry;
  private clients: ClientRegistry;
  private serviceTasks: ServiceTaskRegistry;
  private pendingResponses: Record<string, PendingResponse>;
  private eventBus: EventEmitter;
  private mcp: any;
  private configLoader: ConfigLoader;
  private agentServer: AgentServer;
  private clientServer: ClientServer;
  private serviceServer: ServiceServer;
  private messageHandler: MessageHandler;

  constructor(config: OrchestratorConfig = {}) {
    // Create config loader and get resolved config
    this.configLoader = new ConfigLoader({
      configPath: config.configPath
    });
    
    // Get the fully resolved configuration
    const resolvedConfig = this.configLoader.getResolvedConfig(config);
    
    // Set instance properties from resolved config
    this.port = resolvedConfig.port;
    this.clientPort = resolvedConfig.clientPort;
    this.servicePort = resolvedConfig.servicePort;
    this.logLevel = resolvedConfig.logLevel;
    
    this.agents = new AgentRegistry();
    this.tasks = new AgentTaskRegistry();
    this.services = new ServiceRegistry();
    this.clients = new ClientRegistry();
    this.serviceTasks = new ServiceTaskRegistry();
    this.pendingResponses = {}; // Track pending responses
    
    // Create event bus for communication between components
    this.eventBus = new EventEmitter();
    
    // Set up MCP support
    this.mcp = mcp.setup(this.eventBus);
    
    // Create message handler to centralize business logic
    this.messageHandler = new MessageHandler({
      agents: this.agents,
      tasks: this.tasks,
      services: this.services,
      serviceTasks: this.serviceTasks,
      clients: this.clients,
      eventBus: this.eventBus,
      mcp: this.mcp
    });
    
    // Create servers with specific dependencies rather than passing the entire orchestrator
    this.agentServer = new AgentServer(
      { agents: this.agents }, 
      this.eventBus, 
      { port: this.port },
      this.messageHandler
    );
    
    this.clientServer = new ClientServer(
      this.eventBus, 
      { 
        clientPort: this.clientPort,
        clientRegistry: this.clients
      }
    );
    
    this.serviceServer = new ServiceServer(
      { services: this.services },
      this.eventBus,
      { port: this.servicePort }
    );
    
    // Set up event listeners
    this.setupEventListeners();
  }

  //OK
  private setupEventListeners(): void {
    // IMPORTANT NOTE: When adding or modifying event handlers, ensure:
    // 1. Event names are unique and specific
    // 2. Parameter counts match between emitter and listener
    // 3. All emitters include proper error handling
    
    // Listen for task created events
    this.eventBus.on('task.created', (taskId: string, agentId: string, clientId: string, taskData: any) => {
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
            id: uuidv4(),
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
      } catch (error) {
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
            id: uuidv4(),
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
    this.eventBus.on('agent.register', (message: any, connectionId: string, agentServer: AgentServer) => {
      try {
        const registrationResult = this.agentServer.handleAgentRegistration(message, connectionId);
        if (registrationResult.error) {
          agentServer.sendError(connectionId, registrationResult.error, message.id);
          return;
        }
        
        agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'agent.registered',
          content: registrationResult,
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Agent list request
    this.eventBus.on('agent.list.request', (message: any, connectionId: string, agentServer: AgentServer) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get agent list from registry
        const agents = this.messageHandler.getAgentList(filters);
        
        // Send response
        agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'agent.list.response',
          content: {
            agents: agents
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Service list request
    this.eventBus.on('service.list', (message: any, connectionId: string, agentServer: AgentServer) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get service list directly
        const services = this.services.getAllServices(filters);
        
        // Send response
        agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'service.list.result',
          content: {
            services
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Service task execution
    this.eventBus.on('service.task.execute', async (message: any, connectionId: string, serviceServer: any) => {
      try {
        const result = await this.messageHandler.handleServiceTaskExecuteRequest(message, connectionId);
        
        // Instead of using a callback, send response directly through the serviceServer
        serviceServer.send(connectionId, {
          id: uuidv4(),
          type: 'service.task.result',
          content: result,
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        // Send error through serviceServer
        serviceServer.sendError(
          connectionId,
          'Error executing service task',
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    
    // Task result
    this.eventBus.on('task.result', (message: any, connectionId: string, agentServer: AgentServer) => {
      // Emit task result event
      this.eventBus.emit('task.result.received', message);
      // No response needed
    });
    
    // Task error
    this.eventBus.on('task.error', (message: any, connectionId: string, agentServer: AgentServer) => {
      // Emit task error event
      this.eventBus.emit('task.error.received', message);
      // No response needed
    });
    
    // Task status
    this.eventBus.on('task.status', (message: any, connectionId: string, agentServer: AgentServer) => {
      console.log(`Task status update received: ${message.content.taskId} status: ${message.content.status}`);
      this.eventBus.emit('task.status.received', message);
      // No response needed
    });
    
    // Service task result
    this.eventBus.on('service.task.result', (message: any, connectionId: string, agentServer: AgentServer) => {
      console.log(`Service task result received: ${message.id}`);
      this.eventBus.emit('service.task.result.received', message);
      // No response needed
    });
    
    // Task notification
    this.eventBus.on('task.notification', (message: any, connectionId: string, agentServer: AgentServer) => {
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
        id: uuidv4(),
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
    this.eventBus.on('agent.status', (message: any, connectionId: string, agentServer: AgentServer) => {
      // Get the agent information from the connection
      const statusAgent = this.agents.getAgentByConnectionId(connectionId);
      
      if (!statusAgent) {
        agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
        return;
      }
      
      // Update agent status in the registry
      this.agents.updateAgentStatus(
        statusAgent.id, 
        message.content.status, 
        message.content
      );
      
      // Confirm receipt
      agentServer.send(connectionId, {
        id: uuidv4(),
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
    this.eventBus.on('mcp.servers.list', (message: any, connectionId: string, agentServer: AgentServer) => {
      try {
        const response = this.messageHandler.handleMessage(message, connectionId);
        
        agentServer.send(connectionId, {
          ...response,
          id: uuidv4(),
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // MCP tools list
    this.eventBus.on('mcp.tools.list', (message: any, connectionId: string, agentServer: AgentServer) => {
      try {
        const response = this.messageHandler.handleMessage(message, connectionId);
        
        agentServer.send(connectionId, {
          ...response,
          id: uuidv4(),
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // MCP tool execute
    this.eventBus.on('mcp.tool.execute', (message: any, connectionId: string, agentServer: AgentServer) => {
      try {
        const response = this.messageHandler.handleMessage(message, connectionId);
        
        agentServer.send(connectionId, {
          ...response,
          id: uuidv4(),
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Ping
    this.eventBus.on('ping', (message: any, connectionId: string, agentServer: AgentServer) => {
      agentServer.send(connectionId, {
        id: uuidv4(),
        type: 'pong',
        content: {
          timestamp: Date.now()
        },
        requestId: message.id,
        timestamp: Date.now().toString()
      });
    });
    
    // Backward compatibility: MCP servers list request (UPDATED to direct response pattern)
    this.eventBus.on('mcp.servers.list.request', (message: any, connectionId: string, serverObj: any) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get MCP server list
        const servers = this.mcp.getServerList(filters);
        
        // Send response through the appropriate server
        serverObj.send(connectionId, {
          id: uuidv4(),
          type: 'mcp.servers.list.response',
          content: {
            servers: servers
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        serverObj.sendError(
          connectionId, 
          'Error getting MCP server list', 
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    
    // Backward compatibility: MCP tools list request (UPDATED to direct response pattern)
    this.eventBus.on('mcp.tools.list.request', (message: any, connectionId: string, serverObj: any) => {
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
          id: uuidv4(),
          type: 'mcp.tools.list.response',
          content: {
            serverId,
            tools
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        serverObj.sendError(
          connectionId, 
          'Error getting MCP tools list', 
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    
    // Backward compatibility: MCP tool execute request (UPDATED to direct response pattern)
    this.eventBus.on('mcp.tool.execute.request', async (message: any, connectionId: string, serverObj: any) => {
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
            id: uuidv4(),
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
        } catch (toolError) {
          // Send tool execution error
          serverObj.send(connectionId, {
            id: uuidv4(),
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
      } catch (error) {
        // Send general error
        serverObj.sendError(
          connectionId, 
          'Error executing MCP tool', 
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    
    // Listen for task status update events
    this.eventBus.on('task.status.received', (message: any) => {
      try {
        const { taskId, status, agentId } = message.content;
        console.log(`Processing task status update: ${taskId} status: ${status}`);
        
        if (taskId && status) {
          // Update task status in the registry
          this.tasks.updateTaskStatus(taskId, status, message.content);
          
          // Emit general task status event
          this.eventBus.emit('task.status', message);
          
          // Get the task information
          const task = this.tasks.getTask(taskId);
          
          if (task && task.clientId && typeof task.clientId === 'string') {
            // For in_progress status, only forward the status update without marking as completed
            if (status === 'in_progress') {
              console.log(`Forwarding in-progress status update to client: ${task.clientId}`);
              
              this.clientServer.sendMessageToClient(task.clientId, {
                id: uuidv4(),
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
                id: uuidv4(),
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
                  id: uuidv4(),
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
                id: uuidv4(),
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
          } else if (task && task.clientId) {
            console.warn(`Invalid client ID for task ${taskId}: ${typeof task.clientId}`);
          }
        }
      } catch (error) {
        console.error(`Error handling task status update:`, error);
      }
    });
    
    // Listen for service task created events
    this.eventBus.on('service.task.created', (taskId: string, serviceId: string, agentId: string, clientId: string, taskData: any) => {
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
      } else {
        console.error(`Cannot send task ${taskId} to service ${serviceId}: Service not connected`);
        this.serviceTasks.updateTaskStatus(taskId, 'failed', { error: 'Service not connected' });
      }
    });
    
    // Listen for agent-to-agent request events
    this.eventBus.on('agent.request', (taskId: string, targetAgentId: string, requestingAgentId: string, taskMessage: any) => {
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
    this.eventBus.on('response.message', (message: any) => {
      if (message && message.requestId) {
        this.handleResponseMessage(message);
      }
    });
    
    // Handle task result forwarding to client
    this.eventBus.on('task.result', (clientId: string, taskId: string, content: any) => {
      if (clientId && this.clientServer.hasClientConnection(clientId)) {
        this.clientServer.forwardTaskResultToClient(clientId, taskId, content);
      }
    });
    
    this.eventBus.on('task.error', (clientId: string, message: any) => {
      if (clientId && this.clientServer.hasClientConnection(clientId)) {
        this.clientServer.forwardTaskErrorToClient(clientId, message);
      }
    });

    this.eventBus.on('task.notification', (clientId: string, content: any) => {
      if (clientId && this.clientServer.hasClientConnection(clientId)) {
        this.clientServer.forwardTaskNotificationToClient(clientId, content);
      }
    });

    this.eventBus.on('service.notification', (clientId: string, content: any) => {
      if (clientId && this.clientServer.hasClientConnection(clientId)) {
        this.clientServer.forwardServiceNotificationToClient(clientId, content);
      }
    });

    this.eventBus.on('mcp.task.execution', (clientId: string, content: any) => {
      if (clientId && this.clientServer.hasClientConnection(clientId)) {
        this.clientServer.forwardMCPTaskExecutionToClient(clientId, content);
      }
    });

    // Generic message forwarding to clients
    this.eventBus.on('message.forwardToClient', (message: any) => {
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
      } else {
        console.log(`Client ${message.clientId} is not connected, cannot forward message of type ${message.type}`);
      }
    });

    // Handle client agent list requests
    this.eventBus.on('client.agent.list', (message: any, clientId: string, clientServer: any) => {
      // Redirect to the handler that doesn't use callbacks
      this.eventBus.emit('client.agent.list.request', message, clientId, clientServer);
    });

    // Handle client service list requests
    this.eventBus.on('client.service.list', (message: any, clientId: string, clientServer: any) => {
      // Redirect to the handler that doesn't use callbacks
      this.eventBus.emit('client.service.list.request', message, clientId, clientServer);
    });

    // Handle agent list requests from agents
    this.eventBus.on('agent.list.request', (message: any, connectionId: string, agentServer: any) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get agent list from registry
        const agents = this.messageHandler.getAgentList(filters);
        
        // Send response
        agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'agent.list.response',
          content: {
            agents: agents
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Handle MCP servers list requests
