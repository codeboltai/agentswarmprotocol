/**
 * Agent SDK Type Definitions for Agent Swarm Protocol
 */
import { BaseMessage } from '../common';
import { AgentMessages } from '../messages';
/**
 * Task execute message type from agent messages
 */
export type TaskExecuteMessage = AgentMessages.TaskExecuteMessage;
/**
 * Pending response interface for agent SDK
 */
export interface AgentPendingResponse {
    resolve: (value: BaseMessage) => void;
    reject: (reason?: any) => void;
    timer?: NodeJS.Timeout;
    customEvent?: string;
    anyMessageId?: boolean;
}
/**
 * Agent configuration interface
 */
export interface AgentConfig {
    /** Agent ID */
    agentId?: string;
    /** Agent name */
    name?: string;
    /** Agent type */
    agentType?: string;
    /** Agent capabilities */
    capabilities?: string[];
    /** Agent description */
    description?: string;
    /** Agent manifest */
    manifest?: Record<string, any>;
    /** Orchestrator URL */
    orchestratorUrl?: string;
    /** Auto reconnect flag */
    autoReconnect?: boolean;
    /** Reconnect interval in milliseconds */
    reconnectInterval?: number;
    /** Logger instance */
    logger?: Console;
}
/**
 * Message handler type for agents
 */
export type MessageHandler = (content: any, message: BaseMessage) => void;
/**
 * Task handler type for agents
 */
export type AgentTaskHandler = (taskData: any, message: TaskExecuteMessage) => Promise<any>;
/**
 * Service task options interface
 */
export interface ServiceTaskOptions {
    /** Timeout in milliseconds */
    timeout?: number;
}
//# sourceMappingURL=agentsdk.d.ts.map