import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskOptions } from '../core/types';
export declare class ServiceManager {
    private webSocketManager;
    private logger;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    /**
     * Execute a service tool
     * @param serviceId Service ID or name
     * @param toolId Tool ID
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTool(serviceId: string, toolId: string, params?: Record<string, any>, options?: ServiceTaskOptions): Promise<any>;
    /**
     * Execute a service task (legacy method - now uses toolId)
     * @param serviceId Service ID or name
     * @param toolName Tool name (used as toolId)
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTask(serviceId: string, toolName: string, params?: Record<string, any>, options?: ServiceTaskOptions): Promise<any>;
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    getServiceList(filters?: Record<string, any>): Promise<any[]>;
    /**
     * Get a list of tools for a specific service
     * @param serviceId Service ID or name
     * @param options Optional parameters (e.g., timeout)
     */
    getServiceToolList(serviceId: string, options?: {
        timeout?: number;
    }): Promise<any[]>;
}
