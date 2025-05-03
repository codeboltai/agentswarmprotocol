import { EventEmitter } from 'events';
/**
 * Configuration options for WebSocketClient
 */
export interface WebSocketClientConfig {
    /** WebSocket URL of the orchestrator client interface */
    orchestratorUrl?: string;
    /** Whether to automatically reconnect on disconnection */
    autoReconnect?: boolean;
    /** Interval in ms to attempt reconnection */
    reconnectInterval?: number;
    /** Force the use of browser WebSocket implementation */
    forceBrowserWebSocket?: boolean;
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
}
