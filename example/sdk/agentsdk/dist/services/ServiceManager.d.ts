import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskOptions } from '../core/types';
export declare class ServiceManager {
    private webSocketManager;
    private logger;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    /**
     * Request or execute a service
     * @param serviceName Name of the service
     * @param params Service parameters
     * @param timeout Request timeout
     */
    requestService(serviceName: string, params?: Record<string, any>, timeout?: number): Promise<any>;
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    executeServiceTask(serviceId: string, functionName: string, params?: Record<string, any>, options?: ServiceTaskOptions): Promise<any>;
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    getServiceList(filters?: Record<string, any>): Promise<any[]>;
}
