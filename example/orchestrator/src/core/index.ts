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
import { MCPAdapter, MCPServerConfig, MCPExecuteToolMessage, MCPAgentRequest, MCPServerFilters } from './utils/mcp/mcp-adapter';
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
  private mcpAdapter: MCPAdapter;
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
    this.mcpAdapter = mcp.setup(this.eventBus);
    
    // Create message handler to centralize business logic
    this.messageHandler = new MessageHandler({
      agents: this.agents,
      tasks: this.tasks,
      services: this.services,
      serviceTasks: this.serviceTasks,
      clients: this.clients,
      eventBus: this.eventBus,
      mcp: this.mcpAdapter
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
    
    // MCP-related event listeners
    // Listen for MCP server registration
    this.eventBus.on('mcp.server.register', async (message: MCPServerConfig, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.registerMCPServer(message);
        this.eventBus.emit('mcp.server.register.result', result, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.server.register.error', { error: (error as Error).message }, requestId);
      }
    });

    // Listen for MCP server connection
    this.eventBus.on('mcp.server.connect', async (message: { serverId: string }, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.connectToMCPServer(message.serverId);
        this.eventBus.emit('mcp.server.connect.result', result, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.server.connect.error', { error: (error as Error).message }, requestId);
      }
    });

    // Listen for MCP server disconnection
    this.eventBus.on('mcp.server.disconnect', async (message: { serverId: string }, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.disconnectMCPServer(message.serverId);
        this.eventBus.emit('mcp.server.disconnect.result', result, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.server.disconnect.error', { error: (error as Error).message }, requestId);
      }
    });

    // Listen for MCP tool execution requests
    this.eventBus.on('mcp.tool.execute', async (message: MCPExecuteToolMessage, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.executeMCPTool(
          message.serverId,
          message.toolName,
          message.toolArgs || message.parameters || {}
        );
        this.eventBus.emit('mcp.tool.execute.result', {
          serverId: message.serverId,
          toolName: message.toolName,
          result,
          status: 'success'
        }, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.tool.execute.error', {
          serverId: message.serverId,
          toolName: message.toolName,
          status: 'error',
          error: (error as Error).message
        }, requestId);
      }
    });

    // Listen for MCP server list requests
    this.eventBus.on('mcp.server.list', (message: { filters?: MCPServerFilters }, requestId?: string) => {
      try {
        const result = this.mcpAdapter.listMCPServers(message.filters);
        this.eventBus.emit('mcp.server.list.result', { servers: result }, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.server.list.error', { error: (error as Error).message }, requestId);
      }
    });

    // Also listen for SDK-style 'mcp.servers.list' for compatibility
    this.eventBus.on('mcp.servers.list', (message: { filters?: MCPServerFilters }, requestId?: string) => {
      try {
        const result = this.mcpAdapter.listMCPServers(message.filters);
        this.eventBus.emit('mcp.server.list.result', { servers: result }, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.server.list.error', { error: (error as Error).message }, requestId);
      }
    });

    // Listen for MCP tool list requests
    this.eventBus.on('mcp.tool.list', async (message: { serverId: string }, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.listMCPTools(message.serverId);
        this.eventBus.emit('mcp.tool.list.result', {
          serverId: message.serverId,
          tools: result
        }, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.tool.list.error', { error: (error as Error).message }, requestId);
      }
    });

    // Also listen for SDK-style 'mcp.tools.list' for compatibility
    this.eventBus.on('mcp.tools.list', async (message: { serverId: string }, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.listMCPTools(message.serverId);
        this.eventBus.emit('mcp.tool.list.result', {
          serverId: message.serverId,
          tools: result
        }, requestId);
      } catch (error) {
        this.eventBus.emit('mcp.tool.list.error', { error: (error as Error).message }, requestId);
      }
    });

    // Listen for agent task requests that might involve MCP
    this.eventBus.on('agent.task.mcp', async (message: MCPAgentRequest, agentId: string, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.handleAgentMCPRequest(message, agentId);
        this.eventBus.emit('agent.task.mcp.result', result, requestId);
      } catch (error) {
        this.eventBus.emit('agent.task.mcp.error', { error: (error as Error).message }, requestId);
      }
    });

    // Agent MCP Servers List Request
    this.eventBus.on('agent.mcp.servers.list', (message: { filters?: MCPServerFilters }, requestId?: string) => {
      try {
        const servers = this.mcpAdapter.listMCPServers(message.filters || {});
        this.eventBus.emit('agent.mcp.servers.list.result', {
          servers
        }, requestId);
      } catch (error) {
        this.eventBus.emit('agent.mcp.servers.list.error', { error: (error as Error).message }, requestId);
      }
    });

    // Agent MCP Tools List Request
    this.eventBus.on('agent.mcp.tools.list', async (message: { serverId: string }, requestId?: string) => {
      try {
        const tools = await this.mcpAdapter.listMCPTools(message.serverId);
        // We don't have direct access to the server details via getServerById from the adapter
        // Instead of accessing mcpManager directly, we just use the serverId as the name
        // This simplifies our architecture by keeping the adapter as the single access point
        this.eventBus.emit('agent.mcp.tools.list.result', {
          serverId: message.serverId,
          serverName: message.serverId, // Using serverId as fallback name
          tools
        }, requestId);
      } catch (error) {
        this.eventBus.emit('agent.mcp.tools.list.error', { error: (error as Error).message }, requestId);
      }
    });

    // Agent MCP Tool Execute Request
    this.eventBus.on('agent.mcp.tool.execute', async (message: { serverId: string, toolName: string, parameters: Record<string, any> }, requestId?: string) => {
      try {
        const result = await this.mcpAdapter.executeMCPTool(
          message.serverId,
          message.toolName,
          message.parameters
        );
        this.eventBus.emit('agent.mcp.tool.execute.result', {
          serverId: message.serverId,
          toolName: message.toolName,
          result,
          status: 'success'
        }, requestId);
      } catch (error) {
        this.eventBus.emit('agent.mcp.tool.execute.error', {
          serverId: message.serverId,
          toolName: message.toolName,
          status: 'error',
          error: (error as Error).message
        }, requestId);
      }
    });
    
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
    this.eventBus.on('agent.register', (message: any, connectionId: string) => {
      try {
        const registrationResult = this.agentServer.handleAgentRegistration(message, connectionId);
        if (registrationResult.error) {
          this.agentServer.sendError(connectionId, registrationResult.error, message.id);
          return;
        }
        
        this.agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'agent.registered',
          content: registrationResult,
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Agent list request
    this.eventBus.on('agent.list.request', (message: any, connectionId: string) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get agent list from registry
        const agents = this.messageHandler.getAgentList(filters);
        
        // Send response
        this.agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'agent.list.response',
          content: {
            agents: agents
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Service list request
    this.eventBus.on('service.list', (message: any, connectionId: string) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get service list directly
        const services = this.services.getAllServices(filters);
        
        // Send response
        this.agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'service.list.result',
          content: {
            services
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Service task execution
    this.eventBus.on('service.task.execute', async (message: any, connectionId: string) => {
      try {
        const result = await this.messageHandler.handleServiceTaskExecuteRequest(message, connectionId);
        
        // Instead of using a callback, send response directly through the serviceServer
        this.agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'service.task.result',
          content: result,
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        // Send error through serviceServer
        this.agentServer.sendError(
          connectionId,
          `Error executing service task: ${error instanceof Error ? error.message : String(error)}`,
          message.id
        );
      }
    });
    
    // Task result
    this.eventBus.on('task.result', (message: any, connectionId: string) => {
      // Emit task result event
      this.eventBus.emit('task.result.received', message);
      // No response needed
    });
    
    // Task error
    this.eventBus.on('task.error', (message: any, connectionId: string) => {
      // Emit task error event
      this.eventBus.emit('task.error.received', message);
      // No response needed
    });
    
    // Task status
    this.eventBus.on('task.status', (message: any, connectionId: string) => {
      console.log(`Task status update received: ${message.content.taskId} status: ${message.content.status}`);
      this.eventBus.emit('task.status.received', message);
      // No response needed
    });
    
    // Service task result
    this.eventBus.on('service.task.result', (message: any, connectionId: string) => {
      console.log(`Service task result received: ${message.id}`);
      this.eventBus.emit('service.task.result.received', message);
      // No response needed
    });
    
    // Task notification
    this.eventBus.on('task.notification', (message: any, connectionId: string) => {
      // Get the agent information from the connection
      const agent = this.agents.getAgentByConnectionId(connectionId);
      
      if (!agent) {
        this.agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
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
      this.agentServer.send(connectionId, {
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
    this.eventBus.on('agent.status', (message: any, connectionId: string) => {
      // Get the agent information from the connection
      const statusAgent = this.agents.getAgentByConnectionId(connectionId);
      
      if (!statusAgent) {
        this.agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
        return;
      }
      
      // Update agent status in the registry
      this.agents.updateAgentStatus(
        statusAgent.id, 
        message.content.status, 
        message.content
      );
      
      // Confirm receipt
      this.agentServer.send(connectionId, {
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

    ////////--------------------Check Start --------------------

    
    // MCP servers list
    this.eventBus.on('mcp.servers.list', (message: any, connectionId: string) => {
      try {
        const response = this.messageHandler.handleMessage(message, connectionId);
        
        this.agentServer.send(connectionId, {
          ...response,
          id: uuidv4(),
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // MCP tools list
    this.eventBus.on('mcp.tools.list', (message: any, connectionId: string) => {
      try {
        const response = this.messageHandler.handleMessage(message, connectionId);
        
        this.agentServer.send(connectionId, {
          ...response,
          id: uuidv4(),
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // MCP tool execute
    this.eventBus.on('mcp.tool.execute', (message: any, connectionId: string) => {
      try {
        const response = this.messageHandler.handleMessage(message, connectionId);
        
        this.agentServer.send(connectionId, {
          ...response,
          id: uuidv4(),
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Ping
    this.eventBus.on('ping', (message: any, connectionId: string) => {
      this.agentServer.send(connectionId, {
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
    this.eventBus.on('mcp.servers.list.request', (message: any, connectionId: string) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get MCP server list
        const servers = this.mcpAdapter.listMCPServers(filters);
        
        // Send response through the appropriate server
        this.agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'mcp.servers.list.response',
          content: {
            servers: servers
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(
          connectionId, 
          `Error getting MCP server list: ${error instanceof Error ? error.message : String(error)}`,
          message.id
        );
      }
    });
    
    // Backward compatibility: MCP tools list request (UPDATED to direct response pattern)
    this.eventBus.on('mcp.tools.list.request', (message: any, connectionId: string) => {
      try {
        const serverId = message.content?.serverId;
        
        if (!serverId) {
          this.agentServer.sendError(connectionId, 'Server ID is required', message.id);
          return;
        }
        
        // Get tools for the server
        const tools = this.mcpAdapter.getToolList(serverId);
        
        // Send response
        this.agentServer.send(connectionId, {
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
        this.agentServer.sendError(
          connectionId, 
          `Error getting MCP tools list: ${error instanceof Error ? error.message : String(error)}`,
          message.id
        );
      }
    });
    
    // Backward compatibility: MCP tool execute request (UPDATED to direct response pattern)
    this.eventBus.on('mcp.tool.execute.request', async (message: any, connectionId: string) => {
      try {
        const params = message.content || {};
        const { serverId, toolName, parameters } = params;
        
        if (!serverId || !toolName) {
          this.agentServer.sendError(connectionId, 'Server ID and tool name are required', message.id);
          return;
        }
        
        try {
          // Execute the tool (using await for cleaner code)
          const result = await this.mcpAdapter.executeServerTool(serverId, toolName, parameters || {});
          
          // Send success response
          this.agentServer.send(connectionId, {
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
          this.agentServer.send(connectionId, {
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
        this.agentServer.sendError(
          connectionId, 
          `Error executing MCP tool: ${error instanceof Error ? error.message : String(error)}`,
          message.id
        );
      }
    });
    ////////--------------------Check End --------------------
    
    // Listen for task status update events
    this.eventBus.on('task.status.received', (message: any) => {
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
    this.eventBus.on('agent.list.request', (message: any, connectionId: string) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get agent list from registry
        const agents = this.messageHandler.getAgentList(filters);
        
        // Send response
        this.agentServer.send(connectionId, {
          id: uuidv4(),
          type: 'agent.list.response',
          content: {
            agents: agents
          },
          requestId: message.id,
          timestamp: Date.now().toString()
        });
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });
    
    // Handle agent status update requests
    this.eventBus.on('agent.status.update', (message: any, connectionId: string) => {
      try {
        const agent = this.agents.getAgentByConnectionId(connectionId);
        if (!agent) {
          this.agentServer.sendError(connectionId, 'Agent not registered or unknown', message.id);
          return;
        }
        
        const { status, message: statusMessage } = message.content;
        if (!status) {
          this.agentServer.sendError(connectionId, 'Status is required for status update', message.id);
          return;
        }
        
        // Update agent status in the registry
        this.agents.updateAgentStatus(agent.id, status, {
          message: statusMessage,
          updatedAt: new Date().toISOString()
        });
        
        // Send success response directly
        this.agentServer.send(connectionId, {
          id: uuidv4(),
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
      } catch (error) {
        this.agentServer.sendError(connectionId, error instanceof Error ? error.message : String(error), message.id);
      }
    });

    // Handle client messages to agents
    this.eventBus.on('client.message.agent', async (message: any, targetAgentId: string, clientServer: any) => {
      try {
        // Extract the client ID from the message
        const clientId = message.content.sender.id;
        
        // Create a task for the agent
        const taskId = uuidv4();
        const conversationId = uuidv4(); // Generate a conversation ID if not provided
        
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
          status: 'pending' as TaskStatus,
          createdAt: new Date().toISOString(),
          taskData
        });

        // Emit task created event
        this.eventBus.emit('task.created', taskId, targetAgentId, clientId, taskData);

        // Send response back to the client
        clientServer.send(clientId, {
          id: uuidv4(),
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
      } catch (error) {
        console.error('Error handling client message:', error);
        const clientId = message.content?.sender?.id;
        if (clientId) {
          clientServer.sendError(
            clientId, 
            'Error sending message to agent', 
            message.id, 
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    });

    // Handle service notifications
    this.eventBus.on('service.notification.received', (message: any) => {
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
                id: uuidv4(),
                type: 'service.notification',
                content: message.content,
                timestamp: Date.now().toString()
              });
            } catch (error) {
              console.warn(`Error forwarding service notification to agent ${agentId}:`, error);
            }
          } else {
            console.warn(`Cannot forward service notification to agent ${agentId}: Agent not connected`);
          }
        }
      }
    });
    
    // Handle task notifications
    this.eventBus.on('task.notification.received', (message: any) => {
      // Extract clientId from metadata or look up in task registry
      let clientId = null;
      
      if (message.content && message.content.metadata && message.content.metadata.clientId) {
        // Get clientId directly from message metadata
        clientId = message.content.metadata.clientId;
      } else if (message.taskId) {
        // Look up task to find the clientId
        try {
          const task = this.tasks.getTask(message.taskId);
          if (task && task.clientId) {
            clientId = task.clientId;
          }
        } catch (error) {
          console.error(`Error looking up task for notification: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // If we found a valid clientId, forward the notification
      if (clientId && typeof clientId === 'string' && this.clientServer.hasClientConnection(clientId)) {
        this.clientServer.forwardTaskNotificationToClient(clientId, message.content);
      } else {
        console.warn(`Cannot forward task notification: Invalid or disconnected clientId [${clientId}]`, message);
      }
    });
    
    // Handle service task results
    this.eventBus.on('service.task.result.received', (message: any, connectionId: string, serviceServer: any) => {
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
                id: uuidv4(),
                type: 'service.task.result',
                content: message.content,
                requestId: message.id
              });
            }
          }
        }
      } catch (error) {
        console.error('Error processing service task result:', error);
      }
    });

    // Handle service errors
    this.eventBus.on('service.error.received', (message: any, connectionId: string, serviceServer: any) => {
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
                id: uuidv4(),
                type: 'service.error',
                content: message.content,
                requestId: message.id
              });
            }
          }
        }
      } catch (error) {
        console.error('Error processing service error:', error);
      }
    });

    // Client registration handler
    this.eventBus.on('client.register', (message: any, clientId: string, clientServer: any) => {
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
          id: message.id || uuidv4(),
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
      } catch (error) {
        clientServer.sendError(clientId, 'Error registering client', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client list request handler
    this.eventBus.on('client.list.request', (message: any, clientId: string, clientServer: any) => {
      try {
        const content = message.content || {};
        const filters = content.filters || {};
        
        // Get client list from registry
        const clients = this.clients.getAllClients(filters);
        
        // Send response
        clientServer.send(clientId, {
          id: message.id || uuidv4(),
          type: 'client.list.response',
          content: {
            clients: clients
          }
        });
      } catch (error) {
        clientServer.sendError(clientId, 'Error getting client list', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client task creation request handler
    this.eventBus.on('client.task.create.request', (message: any, clientId: string, clientServer: any) => {
      try {
        // Process task creation through the message handler
        this.messageHandler.handleTaskCreation(message, clientId)
          .then((result: any) => {
            // Send initial task created message
            clientServer.send(clientId, {
              id: uuidv4(),
              type: 'task.created',
              content: result
            });
          })
          .catch((error: Error) => {
            clientServer.sendError(clientId, 'Error creating task', message.id, error.message);
          });
      } catch (error) {
        clientServer.sendError(clientId, 'Error creating task', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client task status request handler
    this.eventBus.on('client.task.status.request', (message: any, clientId: string, clientServer: any) => {
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
          id: message.id || uuidv4(),
          type: 'task.status',
          content: {
            taskId,
            status: task.status,
            agentId: task.agentId,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          }
        });
      } catch (error) {
        clientServer.sendError(clientId, 'Error getting task status', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client agent list request handler
    this.eventBus.on('client.agent.list.request', (message: any, clientId: string, clientServer: any) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get agent list from registry
        const agents = this.messageHandler.getAgentList(filters);
        
        // Send response
        clientServer.send(clientId, {
          id: message.id || uuidv4(),
          type: 'agent.list',
          content: {
            agents: agents
          }
        });
      } catch (error) {
        clientServer.sendError(clientId, 'Error getting agent list', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client MCP server list request handler
    this.eventBus.on('client.mcp.server.list.request', (message: any, clientId: string, clientServer: any) => {
      try {
        const filters = message.content?.filters || {};
        
        // Get MCP server list
        const servers = this.mcpAdapter.listMCPServers(filters);
        
        // Send response
        clientServer.send(clientId, {
          id: message.id || uuidv4(),
          type: 'mcp.server.list',
          content: {
            servers: servers
          }
        });
      } catch (error) {
        clientServer.sendError(clientId, 'Error getting MCP server list', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client MCP server tools request handler
    this.eventBus.on('client.mcp.server.tools.request', (message: any, clientId: string, clientServer: any) => {
      try {
        const serverId = message.content?.serverId;
        
        if (!serverId) {
          return clientServer.sendError(clientId, 'Invalid request', message.id, 'Server ID is required');
        }
        
        // Get tools for the server
        const tools = this.mcpAdapter.getToolList(serverId);
        
        // Send response
        clientServer.send(clientId, {
          id: message.id || uuidv4(),
          type: 'mcp.server.tools',
          content: {
            serverId,
            tools
          }
        });
      } catch (error) {
        clientServer.sendError(clientId, 'Error getting MCP server tools', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client MCP tool execution request handler
    this.eventBus.on('client.mcp.tool.execute.request', (message: any, clientId: string, clientServer: any) => {
      try {
        const serverId = message.content?.serverId;
        const toolName = message.content?.toolName;
        const parameters = message.content?.parameters || {};
        
        if (!serverId || !toolName) {
          return clientServer.sendError(clientId, 'Invalid request', message.id, 'Server ID and tool name are required');
        }
        
        // Execute MCP tool
        this.mcpAdapter.executeServerTool(serverId, toolName, parameters)
          .then((result: any) => {
            clientServer.send(clientId, {
              id: message.id || uuidv4(),
              type: 'mcp.tool.execution.result',
              content: {
                serverId,
                toolName,
                status: 'success',
                result
              }
            });
          })
          .catch((error: Error) => {
            clientServer.sendError(clientId, 'Error executing MCP tool', message.id, error.message);
          });
      } catch (error) {
        clientServer.sendError(clientId, 'Error executing MCP tool', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });
    
    // Client direct message handler
    this.eventBus.on('client.direct.message', (message: any, clientId: string, clientServer: any) => {
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
            this.eventBus.emit('client.message.agent', enhancedMessage, targetId, (result: any) => {
              if (result.error) {
                clientServer.sendError(clientId, 'Error sending message to agent', message.id, result.error);
                return;
              }
              
              // Confirm message delivery
              clientServer.send(clientId, {
                id: message.id || uuidv4(),
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
            this.eventBus.emit('client.message.client', enhancedMessage, targetId, (result: any) => {
              if (result.error) {
                clientServer.sendError(clientId, 'Error sending message to client', message.id, result.error);
                return;
              }
              
              // Confirm message delivery
              clientServer.send(clientId, {
                id: message.id || uuidv4(),
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
            clientServer.sendError(
              clientId,
              'Unsupported target type',
              message.id,
              `Target type '${targetType}' is not supported`
            );
            break;
        }
      } catch (error) {
        clientServer.sendError(clientId, 'Error processing direct message', message.id,
          error instanceof Error ? error.message : String(error));
      }
    });

    // Service event handlers
    this.eventBus.on('service.register', (message: any, connectionId: string, serviceServer: any) => {
      try {
        const content = message.content || {};
        
        if (!content.name) {
          return serviceServer.sendError(connectionId, 'Service name is required', message.id);
        }
        
        // Register the service
        const serviceId = content.id || uuidv4();
        const service = {
          id: serviceId,
          name: content.name,
          type: content.type || 'service',
          capabilities: content.capabilities || [],
          status: 'online' as ServiceStatus,
          connectionId, // Include the connectionId in the service object
          registeredAt: new Date().toISOString(),
          metadata: content.metadata || {}
        };
        
        // Register in registry - passing only the service object
        this.services.registerService(service);
        
        // Respond with confirmation
        serviceServer.send(connectionId, {
          id: uuidv4(),
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
      } catch (error) {
        serviceServer.sendError(
          connectionId, 
          'Error registering service', 
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    
    this.eventBus.on('service.status.update', (message: any, connectionId: string, serviceServer: any) => {
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
          id: uuidv4(),
          type: 'service.status.updated',
          content: {
            id: service.id,
            status,
            message: 'Service status updated successfully'
          },
          requestId: message.id
        });
        
        console.log(`Service ${service.name} (${service.id}) status updated to ${status}`);
      } catch (error) {
        serviceServer.sendError(
          connectionId, 
          'Error updating service status', 
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    
    this.eventBus.on('service.task.notification', (message: any, connectionId: string, serviceServer: any) => {
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
          id: uuidv4(),
          type: 'notification.received',
          content: {
            message: 'Notification received',
            notificationId: message.id
          },
          requestId: message.id
        });
      } catch (error) {
        serviceServer.sendError(
          connectionId, 
          'Error processing notification', 
          message.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  //OK
  /**
   * Start the orchestrator and all its servers
   */
  async start(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to start orchestrator:', error);
      throw error;
    }
  }

  //Ok
  /**
   * Initialize MCP servers from configuration
   */
  private async initMCPServersFromConfig(): Promise<void> {
    const mcpServers = this.configLoader.getMCPServers();
    
    if (mcpServers && mcpServers.length > 0) {
      for (const serverConfig of mcpServers) {
        try {
          // Include command and args from the config
          await this.mcpAdapter.registerMCPServer({
            id: serverConfig.id || uuidv4(),
            name: serverConfig.name,
            type: serverConfig.type || 'node',
            capabilities: serverConfig.capabilities || [],
            path: serverConfig.path,
            command: serverConfig.command,
            args: serverConfig.args,
            metadata: serverConfig.metadata || {}
          });
          
          console.log(`Registered MCP server: ${serverConfig.name}`);
        } catch (error) {
          console.error(`Failed to register MCP server ${serverConfig.name}:`, error);
        }
      }
    }
  }

  // Can skip this logic and rely on the Agent.register() method
  /**
   * Initialize agents from configuration
   */
  private async initAgentsFromConfig(): Promise<void> {
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
  private async initServicesFromConfig(): Promise<void> {
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
  async sendAndWaitForResponse(
    wsOrConnectionId: WebSocketWithId | string, 
    message: any, 
    options: SendOptions = {}
  ): Promise<any> {
    const messageId = message.id || uuidv4();
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
    let ws: WebSocketWithId;
    
    if (typeof wsOrConnectionId === 'string') {
      // Get the WebSocket from the connection ID
      const connection = this.agents.getConnection(wsOrConnectionId);
      
      if (!connection) {
        delete this.pendingResponses[messageId];
        throw new Error(`Connection with ID ${wsOrConnectionId} not found`);
      }
      
      ws = connection as WebSocketWithId;
    } else {
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
  private handleResponseMessage(message: any): void {
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
  async stop(): Promise<void> {
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
    } catch (error) {
      console.error('Error stopping orchestrator:', error);
      throw error;
    }
  }
}

// Create and export singleton orchestrator instance
const orchestrator = new Orchestrator();

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
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully');
    try {
      await orchestrator.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}


export default orchestrator;
export { Orchestrator }; 