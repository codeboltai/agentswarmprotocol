/**
 * Agent Swarm Protocol - Client Messages
 * 
 * Type definitions for messages exchanged between clients and the orchestrator
 */

import { BaseMessage } from '../common';

// ==========================================
// Orchestrator -> Client Message Types
// ==========================================

/**
 * Welcome message sent to client on connection
 */
export interface OrchestratorWelcomeMessage extends BaseMessage {
  type: 'orchestrator.welcome';
  content: {
    /** Client ID assigned by the orchestrator */
    clientId: string;
    /** Orchestrator version */
    version: string;
    /** Welcome message */
    message?: string;
    /** Configuration settings */
    config?: Record<string, any>;
  };
}

/**
 * Response with the list of available agents
 */
export interface AgentListMessage extends BaseMessage {
  type: 'agent.list';
  content: {
    /** Array of available agents */
    agents: Array<{
      /** Agent ID */
      id: string;
      /** Agent name */
      name: string;
      /** Agent status */
      status: string;
      /** Agent capabilities */
      capabilities: string[];
      /** Optional agent description */
      description?: string;
    }>;
  };
}

/**
 * Response with task creation confirmation
 */
export interface TaskCreatedMessage extends BaseMessage {
  type: 'task.created';
  content: {
    /** Task ID */
    taskId: string;
    /** Agent ID that will handle the task */
    agentId: string;
    /** Task status */
    status: string;
  };
}

/**
 * Message with task status update
 */
export interface TaskStatusMessage extends BaseMessage {
  type: 'task.status';
  content: {
    /** Task ID */
    taskId: string;
    /** Task status */
    status: string;
    /** Task result if available */
    result?: any;
    /** When the task was created */
    createdAt: string;
    /** When the task was completed, if it is */
    completedAt?: string;
  };
}

/**
 * Message with task result
 */
export interface TaskResultMessage extends BaseMessage {
  type: 'task.result';
  content: {
    /** Task ID */
    taskId: string;
    /** Task status */
    status: string;
    /** Task result data */
    result: any;
    /** When the task was completed */
    completedAt: string;
  };
}

/**
 * Task notification message from orchestrator to client
 * Used to provide real-time updates about task progress or agent actions
 */
export interface TaskNotificationMessage extends BaseMessage {
  type: 'task.notification';
  content: {
    /** ID of the task this notification is related to (optional) */
    taskId?: string;
    /** ID of the agent that sent the notification */
    agentId: string;
    /** Name of the agent that sent the notification */
    agentName: string;
    /** Type of notification (info, warning, step, progress, etc.) */
    notificationType: string;
    /** Notification message */
    message: string;
    /** Optional notification data with any additional details */
    data?: any;
    /** Optional notification level (info, warning, error, etc.) */
    level?: 'info' | 'warning' | 'error' | 'debug';
    /** Timestamp when this notification was generated */
    timestamp: string;
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
    /** Optional details */
    details?: any;
  };
}

/**
 * Message with list of MCP servers
 */
export interface MCPServerListMessage extends BaseMessage {
  type: 'mcp.server.list';
  content: {
    /** Array of MCP servers */
    servers: Array<{
      /** Server ID */
      id: string;
      /** Server name */
      name: string;
      /** Server type */
      type: string;
      /** Server status */
      status: string;
      /** Server capabilities */
      capabilities: string[];
    }>;
  };
}

// ==========================================
// Client -> Orchestrator Message Types
// ==========================================

/**
 * Request to create a task for an agent
 */
export interface TaskCreateMessage extends BaseMessage {
  type: 'task.create';
  content: {
    /** Name of the agent to handle the task */
    agentName: string;
    /** Task data specific to the agent */
    taskData: any;
  };
}

/**
 * Request for task status
 */
export interface TaskStatusRequestMessage extends BaseMessage {
  type: 'task.status';
  content: {
    /** ID of the task to get status for */
    taskId: string;
  };
}

/**
 * Request for agent list
 */
export interface AgentListRequestMessage extends BaseMessage {
  type: 'agent.list';
  content: {
    /** Optional filters for the agent list */
    filters?: {
      /** Filter by agent status */
      status?: string;
      /** Filter by agent capabilities */
      capabilities?: string[];
      /** Filter by agent name (partial match) */
      name?: string;
    };
  };
}

/**
 * Request for MCP server list
 */
export interface MCPServerListRequestMessage extends BaseMessage {
  type: 'mcp.server.list';
  content: {
    /** Optional filters for the server list */
    filters?: {
      /** Filter by server type */
      type?: string;
      /** Filter by server status */
      status?: string;
      /** Filter by server capabilities */
      capabilities?: string[];
    };
  };
} 