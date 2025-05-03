"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusManager = void 0;
const uuid_1 = require("uuid");
class StatusManager {
    constructor(webSocketManager, serviceId, logger = console) {
        this.webSocketManager = webSocketManager;
        this.serviceId = serviceId;
        this.logger = logger;
    }
    /**
     * Set service status
     * @param status New status
     * @param message Status message
     */
    async setStatus(status, message = '') {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.status',
            content: {
                serviceId: this.serviceId,
                status,
                message,
                timestamp: new Date().toISOString()
            }
        });
    }
}
exports.StatusManager = StatusManager;
