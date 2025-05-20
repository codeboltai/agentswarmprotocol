import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskOptions } from '../core/types';
export declare class ServiceManager {
    private webSocketManager;
    private logger;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param toolName Tool name
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
