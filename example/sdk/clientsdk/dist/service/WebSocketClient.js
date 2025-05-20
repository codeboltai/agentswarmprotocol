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
const uuid_1 = require("uuid");
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
        this.defaultTimeout = config.defaultTimeout || 30000;
        this.connected = false;
        this.clientId = null;
        this.ws = null;
        this.forceBrowserWebSocket = config.forceBrowserWebSocket || false;
        this.pendingResponses = new Map();
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
                            this.handleMessage(message);
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
                            this.handleMessage(message);
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
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    async handleMessage(message) {
        var _a, _b, _c;
        // Add debug logging for task-related messages
        if (message.type === 'task.created' || message.type === 'task.result' || message.type === 'task.status') {
            console.log(`WebSocketClient received ${message.type} message:`, message.type === 'task.created' ?
                `taskId: ${(_a = message.content) === null || _a === void 0 ? void 0 : _a.taskId}` :
                `taskId: ${(_b = message.content) === null || _b === void 0 ? void 0 : _b.taskId}, status: ${(_c = message.content) === null || _c === void 0 ? void 0 : _c.status}`);
        }
        // Check for pending responses
        if (message.id && this.pendingResponses.has(message.id)) {
            const { resolve, reject, timeout } = this.pendingResponses.get(message.id);
            clearTimeout(timeout);
            this.pendingResponses.delete(message.id);
            if (message.type === 'error' || (message.content && message.content.error)) {
                reject(new Error(message.content ? message.content.error : 'Unknown error'));
            }
            else {
                console.log(`Resolved pending response for message ID: ${message.id}`);
                resolve(message);
            }
            return;
        }
        // Special handling for task.created messages to help pending requests
        if (message.type === 'task.created' && message.content && message.content.taskId) {
            // Store the relationship between the original request ID and the taskId
            console.log(`Storing taskId ${message.content.taskId} for message ID: ${message.id}`);
            this.emit('task.created.mapping', {
                messageId: message.id,
                taskId: message.content.taskId
            });
        }
        // Emit the full message for central handling
        this.emit('message', message);
        // Also emit specific event types to maintain backward compatibility
        if (message.type === 'task.result' && message.content) {
            this.emit('task.result', message.content);
        }
        else if (message.type === 'task.status' && message.content) {
            this.emit('task.status', message.content);
            // If the status is completed, also emit a task.result event
            // This ensures tasks complete even when only a status message is received
            if (message.content.status === 'completed') {
                console.log('Task completed status received in WebSocketClient, emitting task.result event');
                this.emit('task.result', {
                    ...message.content,
                    result: message.content.result || {}
                });
            }
        }
        // Only handle clientId for welcome messages here
        if (message.type === 'orchestrator.welcome' && message.content && message.content.clientId) {
            this.clientId = message.content.clientId;
        }
    }
    /**
     * Send a request message and wait for a response
     * @param message - The message to send
     * @param options - Additional options
     * @returns The response message
     */
    async sendRequestWaitForResponse(message, options = {}) {
        if (!this.connected) {
            throw new Error('Not connected to orchestrator');
        }
        // Set message ID if not set
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        // Set timestamp if not set
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }
        const timeout = options.timeout || this.defaultTimeout;
        const messageId = message.id;
        const eventName = options.event;
        const noTimeout = options.noTimeout || false;
        // Special case for task.create - we'll return after getting the task.created response
        // since the actual task completion will be handled by event listeners
        const isTaskCreate = message.type === 'task.create';
        console.log(`Sending request with ID ${messageId}${isTaskCreate ? ' (task.create)' : ''}`);
        return new Promise((resolve, reject) => {
            let timeoutId = null;
            let eventHandler = null;
            let taskCreatedHandler = null;
            let taskResultHandler = null;
            let taskId = null;
            // Setup event listener if needed
            if (eventName) {
                eventHandler = (eventData) => {
                    // Check if this event is for our message ID
                    if (eventData && eventData.id === messageId) {
                        cleanup();
                        resolve(eventData);
                    }
                };
                // Add the event listener
                this.on(eventName, eventHandler);
            }
            // For task creation, let's specifically listen for task.created responses
            if (isTaskCreate) {
                // Listen for the task.created message from the orchestrator
                taskCreatedHandler = (createdMsg) => {
                    if (createdMsg &&
                        createdMsg.type === 'task.created' &&
                        createdMsg.id === messageId) {
                        console.log('Task created message received:', JSON.stringify(createdMsg.content));
                        // Store the taskId for reference
                        if (createdMsg.content && createdMsg.content.taskId) {
                            taskId = createdMsg.content.taskId;
                            console.log(`Task created with ID: ${taskId}`);
                            // If noTimeout is true, immediately resolve with the task.created message
                            // The caller will be responsible for setting up event listeners for completion
                            if (noTimeout) {
                                console.log(`noTimeout set, resolving task.create immediately with task ID: ${taskId}`);
                                cleanup();
                                resolve(createdMsg);
                            }
                        }
                    }
                };
                // Add the task.created message listener
                this.on('message', taskCreatedHandler);
            }
            // Create cleanup function
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (eventHandler && eventName) {
                    this.removeListener(eventName, eventHandler);
                }
                if (isTaskCreate && taskCreatedHandler) {
                    this.removeListener('message', taskCreatedHandler);
                }
                this.pendingResponses.delete(messageId);
            };
            // Set timeout if not disabled
            if (!noTimeout) {
                timeoutId = setTimeout(() => {
                    console.log(`Timeout reached for message ${messageId}`);
                    cleanup();
                    if (this.pendingResponses.has(messageId)) {
                        this.pendingResponses.delete(messageId);
                        reject(new Error(`Timeout waiting for response to message ${messageId}`));
                    }
                }, timeout);
            }
            else {
                console.log(`No timeout set for message ${messageId}`);
                // Set a dummy timeout for cleanup purposes
                timeoutId = setTimeout(() => { }, 2147483647); // Max 32-bit integer in milliseconds
            }
            // Store pending response
            this.pendingResponses.set(messageId, {
                resolve: (data) => {
                    cleanup();
                    resolve(data);
                },
                reject: (error) => {
                    cleanup();
                    reject(error);
                },
                timeout: timeoutId
            });
            // Send the message
            this.send(message).catch(error => {
                cleanup();
                reject(error);
            });
        });
    }
    /**
     * Clear all pending responses
     */
    clearPendingResponses() {
        for (const [_, { timeout }] of this.pendingResponses.entries()) {
            clearTimeout(timeout);
        }
        this.pendingResponses.clear();
    }
}
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=WebSocketClient.js.map