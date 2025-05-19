"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = void 0;
const uuid_1 = require("uuid");
class ServiceManager {
    constructor(webSocketManager, logger = console) {
        this.webSocketManager = webSocketManager;
        this.logger = logger;
    }
    /**
     * Request or execute a service
     * @param serviceName Name of the service
     * @param params Service parameters
     * @param timeout Request timeout
     */
    async requestService(serviceName, params = {}, timeout = 30000) {
        try {
            this.logger.debug(`Requesting service "${serviceName}" with params:`, params);
            const response = await this.webSocketManager.sendAndWaitForResponse({
                id: (0, uuid_1.v4)(),
                type: 'service.request',
                content: {
                    service: serviceName,
                    params
                }
            }, timeout);
            if (response.content.error) {
                throw new Error(response.content.error);
            }
            return response.content.result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to request service "${serviceName}": ${errorMessage}`);
            throw error instanceof Error ? error : new Error(errorMessage);
        }
    }
    /**
     * Execute a service task
     * @param serviceId Service ID or name
     * @param functionName Function name
     * @param params Parameters
     * @param options Additional options
     */
    async executeServiceTask(serviceId, functionName, params = {}, options = {}) {
        const { timeout = 30000, clientId } = options;
        const requestId = (0, uuid_1.v4)();
        this.logger.debug(`Executing service task "${functionName}" on service "${serviceId}" with params:`, params);
        try {
            // Make the request
            const response = await this.webSocketManager.sendAndWaitForResponse({
                id: requestId,
                type: 'service.task.execute',
                content: {
                    serviceId,
                    functionName,
                    params,
                    clientId,
                    // Include timestamp for tracking
                    timestamp: new Date().toISOString()
                }
            }, timeout);
            if (response.content && response.content.error) {
                throw new Error(response.content.error);
            }
            return response.content.result;
        }
        catch (error) {
            // Enhance error handling for connection issues
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Connection not found')) {
                this.logger.error(`Service connection error: Unable to find service "${serviceId}"`);
                throw new Error(`Connection not found for service "${serviceId}". Ensure the service is running and properly registered.`);
            }
            if (errorMessage.includes('timed out')) {
                this.logger.error(`Service task timed out: "${functionName}" on service "${serviceId}" after ${timeout}ms`);
                throw new Error(`Service task "${functionName}" timed out after ${timeout}ms. The service might be unresponsive.`);
            }
            this.logger.error(`Failed to execute service task "${functionName}" on service "${serviceId}": ${errorMessage}`);
            throw error instanceof Error ? error : new Error(errorMessage);
        }
    }
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    async getServiceList(filters = {}) {
        try {
            this.logger.debug(`Getting service list with filters:`, filters);
            const response = await this.webSocketManager.sendAndWaitForResponse({
                id: (0, uuid_1.v4)(),
                type: 'service.list',
                content: { filters }
            });
            return response.content.services || [];
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get service list: ${errorMessage}`);
            // Return empty array instead of throwing on service list failures
            // This allows the application to continue even if service discovery fails
            return [];
        }
    }
}
exports.ServiceManager = ServiceManager;
