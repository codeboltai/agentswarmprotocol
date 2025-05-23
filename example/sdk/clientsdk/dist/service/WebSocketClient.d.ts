import { EventEmitter } from 'events';
import { WebSocketClientConfig } from '@agentswarmprotocol/types/sdk/clientsdk';
/**
 * Pending response entry type
 */
interface PendingResponse {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
    customEvent?: string;
    anyMessageId?: boolean;
}
/**
 * WebSocketClient - Handles WebSocket connection to the orchestrator
 * Works in both browser and Node.js environments
 */
export declare class WebSocketClient extends EventEmitter {
    private orchestratorUrl;
    private autoReconnect;
    private reconnectInterval;
    private connected;
    private clientId;
    private ws;
    private forceBrowserWebSocket;
    private isNodeEnvironment;
    private defaultTimeout;
    private pendingResponses;
    /**
     * Create a new WebSocketClient instance
     * @param config - Configuration options
     */
    constructor(config?: WebSocketClientConfig);
    /**
     * Connect to the orchestrator client interface
     * @returns Promise that resolves when connected
     */
    connect(): Promise<void>;
    /**
     * Send a message to the orchestrator
     * @param message - The message to send
     * @returns The message ID or null if not sent
     */
    send(message: any): Promise<string | null>;
    /**
     * Disconnect from the orchestrator
     */
    disconnect(): void;
    /**
     * Get the connection status
     * @returns Whether the client is connected
     */
    isConnected(): boolean;
    /**
     * Get the client ID
     * @returns The client ID or null if not connected
     */
    getClientId(): string | null;
    /**
     * Set the client ID
     * @param clientId - The client ID
     */
    setClientId(clientId: string): void;
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    private handleMessage;
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
     * Clear all pending responses
     */
    clearPendingResponses(): void;
    /**
     * Handle response for a pending request
     * @param requestId - The request ID to handle
     * @param message - The response message
     * @param isError - Whether this is an error response
     * @returns Whether a pending response was found and handled
     */
    handleResponse(requestId: string, message: any, isError?: boolean): boolean;
    /**
     * Get the map of pending responses (for debugging purposes)
     */
    getPendingResponses(): Map<string, PendingResponse>;
}
export {};
