import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
export declare class WebSocketManager extends EventEmitter {
    private orchestratorUrl;
    private autoReconnect;
    private reconnectInterval;
    private logger;
    private ws;
    private connected;
    private connecting;
    constructor(orchestratorUrl: string, autoReconnect?: boolean, reconnectInterval?: number, logger?: Console);
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect(): Promise<WebSocketManager>;
    /**
     * Disconnect from the orchestrator
     */
    disconnect(): WebSocketManager;
    /**
     * Send a message to the orchestrator
     * @param message Message to send
     */
    send(message: BaseMessage): Promise<BaseMessage>;
    /**
     * Check if connected to the orchestrator
     */
    isConnected(): boolean;
}
