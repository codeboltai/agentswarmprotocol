"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
class WebSocketManager extends events_1.EventEmitter {
    constructor(orchestratorUrl, autoReconnect = true, reconnectInterval = 5000, logger = console) {
        super();
        this.orchestratorUrl = orchestratorUrl;
        this.autoReconnect = autoReconnect;
        this.reconnectInterval = reconnectInterval;
        this.logger = logger;
        this.ws = null;
        this.connected = false;
        this.connecting = false;
        this.pendingResponses = new Map();
    }
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect() {
        if (this.connected || this.connecting) {
            return Promise.resolve(this);
        }
        this.connecting = true;
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(this.orchestratorUrl);
                this.ws.on('open', () => {
                    this.connected = true;
                    this.connecting = false;
                    this.emit('connected');
                    resolve(this);
                });
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.emit('message', message);
                    }
                    catch (err) {
                        const error = err;
                        this.emit('error', new Error(`Failed to parse message: ${error.message}`));
                    }
                });
                this.ws.on('error', (error) => {
                    this.emit('error', error);
                    if (this.connecting) {
                        this.connecting = false;
                        reject(error);
                    }
                });
                this.ws.on('close', () => {
                    this.connected = false;
                    this.connecting = false;
                    this.emit('disconnected');
                    if (this.autoReconnect) {
                        setTimeout(() => {
                            this.connect().catch(err => {
                                this.emit('error', new Error(`Reconnection failed: ${err.message}`));
                            });
                        }, this.reconnectInterval);
                    }
                });
            }
            catch (err) {
                this.connecting = false;
                reject(err);
            }
        });
    }
    /**
     * Disconnect from the orchestrator
     */
    disconnect() {
        if (this.ws) {
            this.autoReconnect = false;
            this.ws.close();
        }
        return this;
    }
    /**
     * Send a message to the orchestrator
     * @param message Message to send
     */
    send(message) {
        if (!this.ws || !this.connected) {
            return Promise.reject(new Error('Not connected to orchestrator'));
        }
        return new Promise((resolve, reject) => {
            try {
                const messageString = JSON.stringify(message);
                this.ws.send(messageString, (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(message);
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /**
     * Send a message and wait for a response
     * @param message Message to send
     * @param timeout Timeout in milliseconds
     */
    sendAndWaitForResponse(message, timeout = 30000) {
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timer = setTimeout(() => {
                if (this.pendingResponses.has(message.id)) {
                    this.pendingResponses.delete(message.id);
                    reject(new Error(`Request timed out after ${timeout}ms`));
                }
            }, timeout);
            // Store the pending response handlers
            this.pendingResponses.set(message.id, { resolve, reject, timer });
            // Send the message
            this.send(message).catch(error => {
                clearTimeout(timer);
                this.pendingResponses.delete(message.id);
                reject(error);
            });
        });
    }
    /**
     * Check if connected to the orchestrator
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Get the map of pending responses
     */
    getPendingResponses() {
        return this.pendingResponses;
    }
    /**
     * Handle response for a pending request
     */
    handleResponse(requestId, message, isError = false) {
        if (this.pendingResponses.has(requestId)) {
            const { resolve, reject, timer } = this.pendingResponses.get(requestId);
            clearTimeout(timer);
            this.pendingResponses.delete(requestId);
            if (isError) {
                reject(new Error(message.content ? message.content.error : 'Unknown error'));
            }
            else {
                resolve(message);
            }
            return true;
        }
        return false;
    }
}
exports.WebSocketManager = WebSocketManager;
