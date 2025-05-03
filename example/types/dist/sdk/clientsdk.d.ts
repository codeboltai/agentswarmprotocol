/**
 * Client SDK Type Definitions for Agent Swarm Protocol
 */
/// <reference types="node" />
import { BaseMessage } from '../common';
/**
 * Configuration options for SwarmClientSDK
 */
export interface ClientConfig {
    /** WebSocket URL of the orchestrator client interface */
    orchestratorUrl?: string;
    /** Whether to automatically reconnect on disconnection */
    autoReconnect?: boolean;
    /** Interval in ms to attempt reconnection */
    reconnectInterval?: number;
    /** Client ID for identification */
    clientId?: string;
    /** Auto-connect on initialization */
    autoConnect?: boolean;
    /** Default timeout for requests in milliseconds */
    defaultTimeout?: number;
    /** Force the use of browser WebSocket implementation */
    forceBrowserWebSocket?: boolean;
}
/**
 * Client message for the orchestrator
 * Note: We're not extending BaseMessage to allow optional id
 */
export interface ClientSDKMessage {
    id?: string;
    type: string;
    timestamp?: string;
    requestId?: string;
    content: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Agent information in the client SDK
 */
export interface AgentInfo {
    id: string;
    name: string;
    capabilities: string[];
    status: string;
}
/**
 * Task information in the client SDK
 */
export interface TaskInfo {
    id: string;
    status: string;
    agentId: string;
    data: Record<string, unknown>;
    result?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
/**
 * Task notification in the client SDK
 */
export interface TaskNotificationInfo {
    taskId: string;
    type: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp: string;
}
/**
 * Pending response tracker in the client SDK
 */
export interface PendingResponseData {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeout: NodeJS.Timeout;
}
/**
 * MCP server information in the client SDK
 */
export interface MCPServerInfo {
    id: string;
    name: string;
    capabilities: string[];
    status: string;
    url: string;
}
/**
 * SwarmClientSDK class declaration
 */
export interface SwarmClientSDKInterface {
    orchestratorUrl: string;
    autoReconnect: boolean;
    reconnectInterval: number;
    pendingResponses: Map<string, PendingResponseData>;
    connected: boolean;
    clientId: string | null;
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    getClientId(): string | null;
    handleMessage(message: ClientSDKMessage): Promise<void>;
    send(message: ClientSDKMessage): Promise<string | null>;
    sendAndWaitForResponse(message: ClientSDKMessage, options?: {
        timeout?: number;
    }): Promise<ClientSDKMessage>;
    sendMessage(message: ClientSDKMessage): Promise<unknown>;
    sendRequest(message: Partial<BaseMessage>, options?: {
        timeout?: number;
    }): Promise<unknown>;
    getAgents(filters?: Record<string, unknown>): Promise<AgentInfo[]>;
    getAgentInfo(agentId: string): Promise<AgentInfo>;
    getAgentCapabilities(agentId: string): Promise<string[]>;
    sendTask(agentName: string, taskData: Record<string, unknown>, options?: {
        waitForResult?: boolean;
        timeout?: number;
    }): Promise<TaskInfo>;
    getTaskStatus(taskId: string): Promise<Record<string, unknown>>;
    getTaskResult(taskId: string): Promise<Record<string, unknown>>;
    cancelTask(taskId: string): Promise<boolean>;
    listTasks(filters?: Record<string, unknown>): Promise<TaskInfo[]>;
    listMCPServers(filters?: Record<string, unknown>): Promise<MCPServerInfo[]>;
    on(event: string, listener: (...args: unknown[]) => void): this;
    off(event: string, listener: (...args: unknown[]) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;
    emit(event: string, ...args: unknown[]): boolean;
}
/**
 * The SwarmClientSDK class
 */
export interface SwarmClientSDK extends SwarmClientSDKInterface {
}
//# sourceMappingURL=clientsdk.d.ts.map