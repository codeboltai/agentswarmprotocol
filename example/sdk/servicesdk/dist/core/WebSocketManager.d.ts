import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { PendingResponse } from './types';
export declare class WebSocketManager extends EventEmitter {
    private orchestratorUrl;
    private autoReconnect;
    private reconnectInterval;
    private logger;
    private ws;
    private connected;
    private connecting;
    private pendingResponses;
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
     * Send a message and wait for a response
     * @param message Message to send
     * @param timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message: BaseMessage, timeout?: number): Promise<BaseMessage>;
    /**
     * Check if connected to the orchestrator
     */
    isConnected(): boolean;
    /**
     * Get the map of pending responses
     */
    getPendingResponses(): Map<string, PendingResponse>;
    /**
     * Handle response for a pending request
     */
    handleResponse(requestId: string, message: BaseMessage, isError?: boolean): boolean;
}
