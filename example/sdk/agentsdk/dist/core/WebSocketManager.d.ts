import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { AgentPendingResponse } from './types';
export declare class WebSocketManager extends EventEmitter {
    private orchestratorUrl;
    private autoReconnect;
    private reconnectInterval;
    private logger;
    private ws;
    private connected;
    private connecting;
    private pendingResponses;
    private defaultTimeout;
    constructor(orchestratorUrl: string, autoReconnect?: boolean, reconnectInterval?: number, logger?: Console);
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    private handleMessage;
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
     * Send a request message and wait for a response
     * @param message - The message to send
     * @param options - Additional options
     * @param options.timeout - Timeout in milliseconds
     * @param options.customEvent - Custom event type to wait for (if specified, only messages with this event type will resolve)
     * @param options.anyMessageId - If true, resolve for any message with the custom event type, regardless of message ID
     * @returns The response message
     */
    sendRequestWaitForResponse(message: any, options?: {
        timeout?: number;
        customEvent?: string;
        anyMessageId?: boolean;
    }): Promise<any>;
    /**
     * Check if connected to the orchestrator
     */
    isConnected(): boolean;
    /**
     * Get the map of pending responses
     */
    getPendingResponses(): Map<string, AgentPendingResponse>;
    /**
     * Handle response for a pending request
     */
    handleResponse(requestId: string, message: BaseMessage, isError?: boolean): boolean;
}
