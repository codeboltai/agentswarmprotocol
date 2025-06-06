import { ServiceMessages } from '@agentswarmprotocol/types/messages';
export type ServiceTaskExecuteMessage = ServiceMessages.ServiceTaskExecuteMessage;
export type ServiceNotificationType = ServiceMessages.ServiceNotificationType;
export interface ServiceTool {
    id: string;
    name: string;
    description: string;
    inputSchema?: Record<string, any>;
    outputSchema?: Record<string, any>;
    metadata?: Record<string, any>;
}
export interface ServiceConfig {
    serviceId?: string;
    name?: string;
    capabilities?: string[];
    tools?: ServiceTool[];
    description?: string;
    manifest?: Record<string, any>;
    orchestratorUrl?: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    logger?: Console;
}
export interface ServicePendingResponse {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}
export interface ServiceNotification {
    taskId: string;
    message: string;
    type: ServiceNotificationType;
    timestamp: string;
    data?: any;
}
export type ServiceTaskHandler = (params: any, message: ServiceTaskExecuteMessage) => Promise<any>;
export type TaskHandler = ServiceTaskHandler;
