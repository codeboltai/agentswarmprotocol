import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceNotification } from '../core/types';
export declare class NotificationManager {
    private webSocketManager;
    private serviceId;
    private logger;
    constructor(webSocketManager: WebSocketManager, serviceId: string, logger?: Console);
    /**
     * Send a general notification to clients
     * @param notification Notification data
     */
    notify(notification: any): Promise<void>;
    /**
     * Send a notification to the orchestrator
     * @param notification Notification data
     */
    sendNotification(notification: ServiceNotification | any): Promise<void>;
}
