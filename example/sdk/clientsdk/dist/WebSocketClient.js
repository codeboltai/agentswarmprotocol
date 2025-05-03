"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
/**
 * WebSocketClient - Handles WebSocket connection to the orchestrator
 */
class WebSocketClient extends events_1.EventEmitter {
    /**
     * Create a new WebSocketClient instance
     * @param config - Configuration options
     */
    constructor(config = {}) {
        super();
        this.orchestratorUrl = config.orchestratorUrl || process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';
        this.autoReconnect = config.autoReconnect !== false;
        this.reconnectInterval = config.reconnectInterval || 5000;
        this.connected = false;
        this.clientId = null;
        this.ws = null;
    }
    /**
     * Connect to the orchestrator client interface
     * @returns Promise that resolves when connected
     */
    async connect() {
        if (this.connected) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            try {
                console.log(`Connecting to orchestrator at ${this.orchestratorUrl}`);
                // Create WebSocket connection
                this.ws = new ws_1.default(this.orchestratorUrl);
                // Set up event listeners
                this.ws.on('open', () => {
                    console.log('Connected to orchestrator');
                    this.connected = true;
                    this.emit('connected');
                    resolve();
                });
                this.ws.on('message', async (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.emit('message', message);
                    }
                    catch (error) {
                        console.error('Error handling message:', error);
                        this.emit('error', error);
                    }
                });
                this.ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                });
                this.ws.on('close', () => {
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
            if (!this.connected) {
                return reject(new Error('Not connected to orchestrator'));
            }
            try {
                if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                    this.ws.send(JSON.stringify(message), (err) => {
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
            this.ws.close();
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
