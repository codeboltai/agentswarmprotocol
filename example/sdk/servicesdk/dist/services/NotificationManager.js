"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationManager = void 0;
const uuid_1 = require("uuid");
class NotificationManager {
    constructor(webSocketManager, serviceId, logger = console) {
        this.webSocketManager = webSocketManager;
        this.serviceId = serviceId;
        this.logger = logger;
    }
    /**
     * Send a general notification to clients
     * @param notification Notification data
     */
    async notify(notification) {
        if (!notification.timestamp) {
            notification.timestamp = new Date().toISOString();
        }
        if (!notification.type) {
            notification.type = 'info';
        }
        await this.sendNotification(notification);
    }
    /**
     * Send a notification to the orchestrator
     * @param notification Notification data
     */
    async sendNotification(notification) {
        await this.webSocketManager.send({
            id: (0, uuid_1.v4)(),
            type: 'service.notification',
            content: {
                serviceId: this.serviceId,
                notification
            }
        });
    }
}
exports.NotificationManager = NotificationManager;
