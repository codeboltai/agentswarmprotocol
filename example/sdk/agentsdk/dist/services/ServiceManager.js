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
        // Make the request
        const response = await this.webSocketManager.sendAndWaitForResponse({
            id: requestId,
            type: 'service.task.execute',
            content: {
                serviceId,
                functionName,
                params,
                clientId
            }
        }, timeout);
        if (response.content.error) {
            throw new Error(response.content.error);
        }
        return response.content.result;
    }
    /**
     * Get a list of available services
     * @param filters Filter criteria
     */
    async getServiceList(filters = {}) {
        const response = await this.webSocketManager.sendAndWaitForResponse({
            id: (0, uuid_1.v4)(),
            type: 'service.list',
            content: { filters }
        });
        return response.content.services || [];
    }
}
exports.ServiceManager = ServiceManager;
