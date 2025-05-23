import { ServiceMessages } from '@agentswarmprotocol/types/messages';
export type ServiceTaskExecuteMessage = ServiceMessages.ServiceTaskExecuteMessage;
export type ServiceNotificationType = ServiceMessages.ServiceNotificationType;
export interface ServiceConfig {
    serviceId?: string;
    name?: string;
    capabilities?: string[];
    description?: string;
    manifest?: Record<string, any>;
    orchestratorUrl?: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    logger?: Console;
}
export interface PendingResponse {
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
export type TaskHandler = (params: any, message: ServiceTaskExecuteMessage) => Promise<any>;
