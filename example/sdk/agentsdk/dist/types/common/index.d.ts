/**
 * Common type definitions for Agent Swarm Protocol
 */
/**
 * Base interface for all messages in Agent Swarm Protocol
 */
export interface BaseMessage {
    /** Unique identifier for the message */
    id: string;
    /** Type of message that indicates its purpose */
    type: string;
    /** Optional timestamp of when the message was created */
    timestamp?: string;
    /** Optional request ID when this message is a response to a request */
    requestId?: string;
    /** Main content of the message, structure varies by message type */
    content: any;
}
/**
 * Agent status types
 */
export type AgentStatus = 'online' | 'offline' | 'busy' | 'error' | 'initializing';
/**
 * Service status types
 */
export type ServiceStatus = 'online' | 'offline' | 'busy' | 'error' | 'initializing';
/**
 * Task status types
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
/**
 * Notification level types
 */
export type NotificationLevel = 'info' | 'warning' | 'error' | 'debug';
/**
 * Agent interface representing an agent registered with the orchestrator
 */
export interface Agent {
    /** Unique agent ID */
    id: string;
    /** Agent name */
    name: string;
    /** Agent capabilities/functions */
    capabilities: string[];
    /** Current agent status */
    status: AgentStatus;
    /** Connection ID for the WebSocket */
    connectionId: string;
    /** When the agent was registered */
    registeredAt: string;
    /** Additional agent information */
    manifest?: {
        /** Agent description */
        description?: string;
        /** Agent version */
        version?: string;
        /** Required services */
        requiredServices?: string[];
        /** Additional metadata */
        metadata?: Record<string, any>;
        /** Any other fields */
        [key: string]: any;
    };
}
/**
 * Service interface representing a service registered with the orchestrator
 */
export interface Service {
    /** Unique service ID */
    id: string;
    /** Service name */
    name: string;
    /** Service capabilities/functions */
    capabilities: string[];
    /** Current service status */
    status: ServiceStatus;
    /** Connection ID for the WebSocket */
    connectionId: string;
    /** When the service was registered */
    registeredAt: string;
    /** Additional service information */
    manifest?: {
        /** Service description */
        description?: string;
        /** Service version */
        version?: string;
        /** Whether this service can send notifications */
        supportsNotifications?: boolean;
        /** Additional metadata */
        metadata?: Record<string, any>;
        /** Any other fields */
        [key: string]: any;
    };
}
/**
 * Task interface representing a task registered with the orchestrator
 */
export interface Task {
    /** Unique task ID */
    id: string;
    /** ID of the agent assigned to this task */
    agentId: string;
    /** ID of the client that requested this task */
    clientId?: string;
    /** Current task status */
    status: TaskStatus;
    /** When the task was created */
    createdAt: string;
    /** When the task was completed (if applicable) */
    completedAt?: string;
    /** Task data passed to the agent */
    taskData: any;
    /** Task result returned by the agent */
    result?: any;
    /** Error information if the task failed */
    error?: {
        /** Error message */
        message: string;
        /** Error code */
        code?: string;
        /** Stack trace or additional details */
        details?: any;
    };
}
/**
 * MCP Server interface representing an MCP server registered with the orchestrator
 */
export interface MCPServer {
    /** Unique server ID */
    id: string;
    /** Server name */
    name: string;
    /** Server type */
    type: string;
    /** Server capabilities */
    capabilities: string[];
    /** Server status */
    status: string;
    /** Server path or URL */
    path: string;
}
/**
 * MCP Tool interface representing a tool available on an MCP server
 */
export interface MCPTool {
    /** Tool name */
    name: string;
    /** Tool description */
    description?: string;
    /** Tool parameters */
    parameters?: any;
}
export * from './orchestrator';
