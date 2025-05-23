/**
 * Orchestrator Types for Agent Swarm Protocol
 */
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Agent, Service, Task, TaskStatus, ServiceStatus, AgentStatus } from './index';
export interface OrchestratorConfig {
    port?: number;
    clientPort?: number;
    servicePort?: number;
    logLevel?: string;
    configPath?: string;
}
export interface OrchestratorSettings {
    agentPort?: number;
    clientPort?: number;
    servicePort?: number;
    logLevel?: string;
    taskTimeout?: number;
}
export interface AgentRegistry {
    getAgentById(id: string): Agent | undefined;
    getAgentByName(name: string): Agent | undefined;
    getAllAgents(filters?: any): Agent[];
    getAgentConfigurationByName(name: string): any;
    getAgentByConnectionId(connectionId: string): Agent | undefined;
    registerAgent(agent: Agent): void;
    updateAgentStatus(id: string, status: AgentStatus, details?: any): void;
    removeAgent(id: string): boolean;
}
export interface AgentTaskRegistry {
    registerTask(id: string, taskData: any): void;
    getTask(id: string): Task;
    updateTaskStatus(id: string, status: TaskStatus, result?: any): void;
    getTasks(filters?: any): Task[];
}
export interface ServiceRegistry {
    getServiceById(id: string): Service | undefined;
    getServiceByName(name: string): Service | undefined;
    getAllServices(filters?: any): Service[];
    getServiceByConnectionId(connectionId: string): Service | undefined;
    registerService(service: Service): void;
    updateServiceStatus(id: string, status: ServiceStatus, details?: any): void;
    removeService(id: string): boolean;
    getConnection(connectionId: string): WebSocketWithId | undefined;
    setConnection(connectionId: string, connection: WebSocketWithId): Service | undefined;
    handleDisconnection(connectionId: string): Service | undefined;
}
export interface ServiceTaskRegistry {
    registerTask(id: string, taskData: any): void;
    getTask(id: string): any;
    updateTaskStatus(id: string, status: string, result?: any): void;
    getTasks(filters?: any): any[];
}
export interface ServerConfig {
    port?: number;
    clientPort?: number;
    servicePort?: number;
}
export interface ConnectionOptions {
    agents?: AgentRegistry;
    services?: ServiceRegistry;
    port?: number;
    clientPort?: number;
    servicePort?: number;
}
export interface MCPInterface {
    registerServer(server: any): void;
    listMCPServers(filters?: any): any[];
    getToolList(serverId: string): any[];
    executeServerTool(serverId: string, toolName: string, args: any): Promise<any>;
    registerMCPServer(message: any): Promise<{
        serverId: string;
        name: string;
        status: string;
    }>;
    connectToMCPServer(serverId: string): Promise<{
        serverId: string;
        status: string;
        tools: any[];
    }>;
    disconnectMCPServer(serverId: string): Promise<{
        serverId: string;
        status: string;
    }>;
    executeMCPTool(serverId: string, toolName: string, toolArgs: Record<string, any>): Promise<any>;
    listMCPTools(serverId: string): Promise<any[]>;
    handleAgentMCPRequest(message: any, agentId: string): Promise<any>;
    getServerById(serverId: string): any;
}
export interface MessageHandlerConfig {
    agents: AgentRegistry;
    tasks: AgentTaskRegistry;
    services: ServiceRegistry;
    serviceTasks?: ServiceTaskRegistry;
    eventBus: EventEmitter;
    mcp: MCPInterface;
}
export interface PendingResponse {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timer: NodeJS.Timeout;
}
export interface SendOptions {
    timeout?: number;
    responseType?: string;
    responseFilter?: (response: any) => boolean;
}
export interface WebSocketWithId extends WebSocket {
    id: string;
}
export interface ConfigLoaderOptions {
    configPath?: string;
}
//# sourceMappingURL=orchestrator.d.ts.map