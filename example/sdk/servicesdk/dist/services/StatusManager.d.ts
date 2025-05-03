import { ServiceStatus } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
export declare class StatusManager {
    private webSocketManager;
    private serviceId;
    private logger;
    constructor(webSocketManager: WebSocketManager, serviceId: string, logger?: Console);
    /**
     * Set service status
     * @param status New status
     * @param message Status message
     */
    setStatus(status: ServiceStatus, message?: string): Promise<void>;
}
