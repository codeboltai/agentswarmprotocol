"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
// For Node.js environments
// Using dynamic imports for better cross-environment compatibility
const events_1 = require("events");
/**
 * Determine if code is running in a browser environment
 */
const isBrowser = () => {
    return typeof window !== 'undefined' && typeof window.document !== 'undefined';
};
/**
 * Create a WebSocket instance based on the current environment
 * @param url WebSocket URL to connect to
 */
async function createWebSocketInstance(url) {
    if (isBrowser()) {
        return new window.WebSocket(url);
    }
    else {
        try {
            // Dynamically import the 'ws' package for Node.js environment
            const WebSocketModule = await Promise.resolve().then(() => __importStar(require('ws')));
            return new WebSocketModule.default(url);
        }
        catch (error) {
            throw new Error('Failed to load WebSocket module for Node.js: ' + error);
        }
    }
}
/**
 * WebSocketClient - Handles WebSocket connection to the orchestrator
 * Works in both browser and Node.js environments
 */
class WebSocketClient extends events_1.EventEmitter {
    /**
     * Create a new WebSocketClient instance
     * @param config - Configuration options
     */
    constructor(config = {}) {
        super();
        this.isNodeEnvironment = !isBrowser();
        const defaultUrl = this.isNodeEnvironment
            ? (process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001')
            : ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host);
        this.orchestratorUrl = config.orchestratorUrl || defaultUrl;
        this.autoReconnect = config.autoReconnect !== false;
        this.reconnectInterval = config.reconnectInterval || 5000;
        this.connected = false;
        this.clientId = null;
        this.ws = null;
        this.forceBrowserWebSocket = config.forceBrowserWebSocket || false;
    }
    /**
     * Connect to the orchestrator client interface
     * @returns Promise that resolves when connected
     */
    async connect() {
        if (this.connected) {
            return Promise.resolve();
        }
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Connecting to orchestrator at ${this.orchestratorUrl}`);
                // Determine if we should use the browser's WebSocket implementation
                const shouldUseBrowserWs = this.forceBrowserWebSocket || isBrowser();
                this.ws = await createWebSocketInstance(this.orchestratorUrl);
                if (shouldUseBrowserWs) {
                    // Browser WebSocket implementation
                    const browserWs = this.ws;
                    // Set up browser event listeners
                    browserWs.onopen = () => {
                        console.log('Connected to orchestrator');
                        this.connected = true;
                        this.emit('connected');
                        resolve();
                    };
                    browserWs.onmessage = async (event) => {
                        try {
                            const message = JSON.parse(event.data);
                            this.emit('message', message);
                        }
                        catch (error) {
                            console.error('Error handling message:', error);
                            this.emit('error', error);
                        }
                    };
                    browserWs.onerror = (event) => {
                        const errorMessage = 'WebSocket connection error';
                        console.error('WebSocket error:', event);
                        const customError = {
                            message: errorMessage,
                            originalEvent: event
                        };
                        this.emit('error', customError);
                        reject(customError);
                    };
                    browserWs.onclose = () => {
                        console.log('Disconnected from orchestrator');
                        this.connected = false;
                        this.emit('disconnected');
                        // Attempt to reconnect if enabled
                        if (this.autoReconnect) {
                            console.log(`Attempting to reconnect in ${this.reconnectInterval / 1000} seconds...`);
                            setTimeout(() => this.connect().catch(err => {
                                console.error('Reconnection error:', err);
                            }), this.reconnectInterval);
                        }
                    };
                }
                else {
                    // Node.js WebSocket implementation
                    const nodeWs = this.ws;
                    // Set up Node.js event listeners
                    nodeWs.on('open', () => {
                        console.log('Connected to orchestrator');
                        this.connected = true;
                        this.emit('connected');
                        resolve();
                    });
                    nodeWs.on('message', async (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            this.emit('message', message);
                        }
                        catch (error) {
                            console.error('Error handling message:', error);
                            this.emit('error', error);
                        }
                    });
                    nodeWs.on('error', (error) => {
                        console.error('WebSocket error:', error);
                        this.emit('error', error);
                        reject(error);
                    });
                    nodeWs.on('close', () => {
                        console.log('Disconnected from orchestrator');
                        this.connected = false;
                        this.emit('disconnected');
                        // Attempt to reconnect if enabled
                        if (this.autoReconnect) {
                            console.log(`Attempting to reconnect in ${this.reconnectInterval / 1000} seconds...`);
                            setTimeout(() => this.connect().catch(err => {
                                console.error('Reconnection error:', err);
                            }), this.reconnectInterval);
                        }
                    });
                }
            }
            catch (error) {
                console.error('Connection error:', error);
                reject(error);
            }
        });
    }
    /**
     * Send a message to the orchestrator
     * @param message - The message to send
     * @returns The message ID or null if not sent
     */
    async send(message) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.ws) {
                return reject(new Error('Not connected to orchestrator'));
            }
            try {
                const messageStr = JSON.stringify(message);
                if (this.ws) {
                    if (isBrowser() || this.forceBrowserWebSocket) {
                        // Browser WebSocket implementation
                        const wsReadyState = this.ws.readyState;
                        if (wsReadyState === 1) { // WebSocket.OPEN
                            this.ws.send(messageStr);
                            resolve(message.id);
                        }
                        else {
                            reject(new Error('WebSocket not open, cannot send message'));
                        }
                    }
                    else {
                        // Node.js WebSocket implementation
                        const nodeWs = this.ws;
                        if (nodeWs.readyState === 1) { // WebSocket.OPEN
                            nodeWs.send(messageStr, (err) => {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    resolve(message.id);
                                }
                            });
                        }
                        else {
                            reject(new Error('WebSocket not open, cannot send message'));
                        }
                    }
                }
                else {
                    reject(new Error('WebSocket not initialized, cannot send message'));
                }
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /**
     * Disconnect from the orchestrator
     */
    disconnect() {
        if (this.ws) {
            this.autoReconnect = false; // Disable reconnection
            if (isBrowser() || this.forceBrowserWebSocket) {
                this.ws.close();
            }
            else {
                this.ws.close();
            }
            this.ws = null;
            console.log('Disconnected from orchestrator');
        }
    }
    /**
     * Get the connection status
     * @returns Whether the client is connected
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Get the client ID
     * @returns The client ID or null if not connected
     */
    getClientId() {
        return this.clientId;
    }
    /**
     * Set the client ID
     * @param clientId - The client ID
     */
    setClientId(clientId) {
        this.clientId = clientId;
    }
}
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=WebSocketClient.js.map