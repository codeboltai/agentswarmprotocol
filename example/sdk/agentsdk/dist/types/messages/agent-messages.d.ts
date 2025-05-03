/**
 * Agent Swarm Protocol - Agent Messages
 *
 * Type definitions for messages exchanged between agents and the orchestrator
 */
import { BaseMessage, AgentStatus } from '../common';
/**
 * Welcome message sent to agent on connection
 */
export interface OrchestratorWelcomeMessage extends BaseMessage {
    type: 'orchestrator.welcome';
    content: {
        /** Orchestrator version */
        version: string;
        /** Message of the day or welcome text */
        message?: string;
        /** Any configuration settings to apply */
        config?: Record<string, any>;
    };
}
/**
 * Message to execute a task
 */
export interface TaskExecuteMessage extends BaseMessage {
    type: 'task.execute';
    content: {
        /** Type of task to execute */
        taskType?: string;
        /** Task input data */
        input?: any;
        /** Task metadata */
        metadata?: {
            /** ID of the client that created the task */
            clientId?: string;
            /** ID of the agent that requested this task (for agent-to-agent tasks) */
            requestingAgentId?: string;
            /** Timestamp of when the task was created */
            timestamp?: string;
            /** Any additional metadata */
            [key: string]: any;
        };
        /** Additional task-specific data */
        [key: string]: any;
    };
}
/**
 * Response to an agent registration
 */
export interface AgentRegisteredMessage extends BaseMessage {
    type: 'agent.registered';
    content: {
        /** Assigned agent ID */
        agentId: string;
        /** Agent name */
        name: string;
        /** Success message */
        message: string;
    };
}
/**
 * Response to a service request
 */
export interface ServiceResponseMessage extends BaseMessage {
    type: 'service.response';
    content: {
        /** Service result data */
        [key: string]: any;
    };
}
/**
 * Error message from orchestrator
 */
export interface ErrorMessage extends BaseMessage {
    type: 'error';
    content: {
        /** Error message */
        error: string;
        /** Optional error code */
        code?: string;
        /** Optional stack trace */
        stack?: string;
    };
}
/**
 * Request from another agent
 */
export interface AgentRequestMessage extends BaseMessage {
    type: 'agent.request';
    content: {
        /** The source agent making the request */
        sourceAgent: {
            id: string;
            name: string;
        };
        /** Task data from the source agent */
        taskData: any;
    };
}
/**
 * Response to an agent request that was accepted
 */
export interface AgentRequestAcceptedMessage extends BaseMessage {
    type: 'agent.request.accepted';
    content: {
        /** Target agent that will handle the request */
        targetAgent: string;
        /** Request status */
        status: 'accepted';
        /** Optional message */
        message?: string;
    };
}
/**
 * Ping message to check agent connectivity
 */
export interface PingMessage extends BaseMessage {
    type: 'ping';
    content: {
        /** Timestamp when ping was sent */
        timestamp: string;
    };
}
/**
 * Response with available MCP servers
 */
export interface MCPServersListMessage extends BaseMessage {
    type: 'mcp.servers.list';
    content: {
        /** List of available MCP servers */
        servers: Array<{
            /** Server ID */
            id: string;
            /** Server name */
            name: string;
            /** Server type */
            type: string;
            /** Server capabilities */
            capabilities: string[];
            /** Server status */
            status: string;
        }>;
    };
}
/**
 * Response with tools available in an MCP server
 */
export interface MCPToolsListMessage extends BaseMessage {
    type: 'mcp.tools.list';
    content: {
        /** Server ID */
        serverId: string;
        /** Server name */
        serverName: string;
        /** Available tools */
        tools: Array<{
            /** Tool name */
            name: string;
            /** Tool description */
            description?: string;
            /** Tool parameters */
            parameters?: any;
        }>;
    };
}
/**
 * MCP tool execution result message
 */
export interface MCPToolExecutionResultMessage extends BaseMessage {
    type: 'mcp.tool.execution.result';
    content: {
        /** Server ID */
        serverId: string;
        /** Tool name that was executed */
        toolName: string;
        /** Execution result */
        result: any;
        /** Status of the execution */
        status: 'success' | 'error';
        /** Error message if status is error */
        error?: string;
    };
}
/**
 * Response with list of available agents
 */
export interface AgentListResponseMessage extends BaseMessage {
    type: 'agent.list.response';
    content: {
        /** List of available agents */
        agents: Array<{
            /** Agent ID */
            id: string;
            /** Agent name */
            name: string;
            /** Agent capabilities */
            capabilities: string[];
            /** Agent status */
            status: string;
            /** Agent type */
            agentType?: string;
        }>;
    };
}
/**
 * Agent registration message
 */
export interface AgentRegisterMessage extends BaseMessage {
    type: 'agent.register';
    content: {
        /** Agent name */
        name: string;
        /** Agent capabilities */
        capabilities?: string[];
        /** Agent manifest with additional information */
        manifest?: {
            /** Agent description */
            description?: string;
            /** Required services */
            requiredServices?: string[];
            /** Version information */
            version?: string;
            /** Any additional metadata */
            [key: string]: any;
        };
    };
}
/**
 * Task result message
 */
export interface TaskResultMessage extends BaseMessage {
    type: 'task.result';
    /** The ID of the task this is a result for */
    taskId: string;
    /** For backward compatibility */
    requestId: string;
    content: {
        /** Task result data */
        [key: string]: any;
    };
}
/**
 * Service request message
 */
export interface ServiceRequestMessage extends BaseMessage {
    type: 'service.request';
    content: {
        /** Name of the service to request */
        service: string;
        /** Service parameters */
        params?: Record<string, any>;
    };
}
/**
 * Agent response message (for agent-to-agent communication)
 */
export interface AgentResponseMessage extends BaseMessage {
    type: 'agent.response';
    content: {
        /** ID of the target agent that should receive this response */
        targetAgentId: string;
        /** Response data */
        data: any;
        /** Optional source agent information */
        sourceAgent?: {
            id: string;
            name: string;
        };
    };
}
/**
 * Agent status update message
 */
export interface AgentStatusUpdateMessage extends BaseMessage {
    type: 'agent.status.update';
    content: {
        /** New agent status */
        status: AgentStatus;
        /** Optional message explaining the status change */
        message?: string;
    };
}
/**
 * Pong message (response to ping)
 */
export interface PongMessage extends BaseMessage {
    type: 'pong';
    content: {
        /** Timestamp when pong was sent */
        timestamp?: string;
    };
}
/**
 * Request for MCP servers list
 */
export interface MCPServersListRequestMessage extends BaseMessage {
    type: 'mcp.servers.list.request';
    content: {
        /** Optional filters */
        filters?: {
            /** Filter by server type */
            type?: string;
            /** Filter by server capabilities */
            capabilities?: string[];
        };
    };
}
/**
 * Request for MCP tools list
 */
export interface MCPToolsListRequestMessage extends BaseMessage {
    type: 'mcp.tools.list.request';
    content: {
        /** Server ID or name to get tools for */
        serverId: string;
    };
}
/**
 * Request to execute an MCP tool
 */
export interface MCPToolExecuteRequestMessage extends BaseMessage {
    type: 'mcp.tool.execute.request';
    content: {
        /** Server ID to execute the tool on */
        serverId: string;
        /** Tool name to execute */
        toolName: string;
        /** Tool parameters */
        parameters: any;
        /** Optional timeout in milliseconds */
        timeout?: number;
    };
}
/**
 * Request for agent list
 */
export interface AgentListRequestMessage extends BaseMessage {
    type: 'agent.list.request';
    content: {
        /** Optional filters for the agent list */
        filters?: {
            /** Filter by agent status */
            status?: string;
            /** Filter by agent capabilities */
            capabilities?: string[];
            /** Filter by agent name (partial match) */
            name?: string;
            /** Filter by agent type */
            agentType?: string;
        };
    };
}
/**
 * Request to send a task to another agent
 */
export interface AgentTaskRequestMessage extends BaseMessage {
    type: 'agent.task.request';
    content: {
        /** Name of the target agent that should execute the task */
        targetAgentName: string;
        /** Type of task to execute */
        taskType: string;
        /** Task data */
        taskData: any;
        /** Optional timeout in milliseconds */
        timeout?: number;
    };
}
