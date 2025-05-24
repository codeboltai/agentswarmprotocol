"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const uuid_1 = require("uuid");
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
        this.defaultTimeout = 30000;
    }
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    async handleMessage(message) {
        // Ensure message ID is properly extracted for consistent use
        const messageId = message.requestId || message.id;
        // Check for pending responses
        if (messageId && this.pendingResponses.has(messageId)) {
            const pendingResponse = this.pendingResponses.get(messageId);
            // Check if we need to match a custom event
            if (pendingResponse.customEvent) {
                // Only resolve if the message type matches the custom event
                if (message.type === pendingResponse.customEvent) {
                    const isError = message.type === 'error' || (message.content && message.content.error);
                    this.handleResponse(messageId, message, isError);
                    this.logger.debug(`Resolved pending response for message ID: ${messageId} with custom event: ${pendingResponse.customEvent}`);
                }
                // If custom event doesn't match, don't resolve and continue processing
            }
            else {
                // No custom event specified, resolve for any message with this ID
                const isError = message.type === 'error' || (message.content && message.content.error);
                this.handleResponse(messageId, message, isError);
                this.logger.debug(`Resolved pending response for message ID: ${messageId}`);
            }
        }
        // Check for anyMessageId responses (custom event with any message ID)
        for (const [pendingId, pendingResponse] of this.pendingResponses.entries()) {
            if (pendingResponse.anyMessageId && pendingResponse.customEvent && message.type === pendingResponse.customEvent) {
                const isError = message.type === 'error' || (message.content && message.content.error);
                this.handleResponse(pendingId, message, isError);
                this.logger.debug(`Resolved pending response for ID: ${pendingId} with anyMessageId for custom event: ${pendingResponse.customEvent} (actual message ID: ${messageId})`);
            }
        }
        // Special handling for task.created messages
        if (message.type === 'task.created' && message.content && message.content.taskId) {
            // Store the relationship between the original request ID and the taskId
            this.logger.debug(`Storing taskId ${message.content.taskId} for message ID: ${messageId}`);
            this.emit('task.created.mapping', {
                messageId: messageId,
                taskId: message.content.taskId
            });
        }
        // Emit the message for handling
        this.emit('message', message);
        // Also emit specific event types
        if (message.type === 'agent.task.result' && message.content) {
            this.emit('agent.task.result', message.content);
        }
        else if (message.type === 'task.status' && message.content) {
            this.emit('task.status', message.content);
            // If the status is completed, also emit a agent.task.result event
            if (message.content.status === 'completed') {
                this.logger.debug('Task completed status received, emitting agent.task.result event');
                this.emit('agent.task.result', {
                    ...message.content,
                    result: message.content.result || {}
                });
            }
        }
    }
    /**
     * Connect to the orchestrator
     * @returns {Promise} Resolves when connected
     */
    connect() {
        if (this.connected) {
            this.logger.debug('Already connected to orchestrator');
            return Promise.resolve(this);
        }
        if (this.connecting) {
            this.logger.debug('Already connecting to orchestrator');
            return Promise.resolve(this);
        }
        this.connecting = true;
        this.logger.info(`Connecting to orchestrator at ${this.orchestratorUrl}`);
        return new Promise((resolve, reject) => {
            try {
                // Create WebSocket connection with appropriate error handling
                this.ws = new ws_1.default(this.orchestratorUrl);
                this.ws.on('open', () => {
                    this.connected = true;
                    this.connecting = false;
                    this.logger.info('Connected to orchestrator successfully');
                    this.emit('connected');
                    resolve(this);
                });
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    }
                    catch (err) {
                        const error = err;
                        this.logger.error(`Failed to parse message: ${error.message}`);
                        this.emit('error', new Error(`Failed to parse message: ${error.message}`));
                    }
                });
                this.ws.on('error', (error) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`WebSocket error: ${errorMessage}`);
                    this.emit('error', error);
                    if (this.connecting) {
                        this.connecting = false;
                        reject(error);
                    }
                });
                this.ws.on('close', (code, reason) => {
                    this.connected = false;
                    this.connecting = false;
                    this.logger.info(`Disconnected from orchestrator. Code: ${code}, Reason: ${reason}`);
                    this.emit('disconnected');
                    // Reject any pending responses with connection closed error
                    for (const [id, pendingResponse] of this.pendingResponses.entries()) {
                        if (pendingResponse.timer) {
                            clearTimeout(pendingResponse.timer);
                        }
                        pendingResponse.reject(new Error('Connection closed'));
                        this.pendingResponses.delete(id);
                    }
                    if (this.autoReconnect) {
                        this.logger.info(`Will attempt to reconnect in ${this.reconnectInterval}ms`);
                        setTimeout(() => {
                            this.connect().catch(err => {
                                const reconnectError = err instanceof Error ? err.message : String(err);
                                this.logger.error(`Reconnection failed: ${reconnectError}`);
                                this.emit('error', new Error(`Reconnection failed: ${reconnectError}`));
                            });
                        }, this.reconnectInterval);
                    }
                });
            }
            catch (err) {
                this.connecting = false;
                const connectionError = err instanceof Error ? err.message : String(err);
                this.logger.error(`Failed to create WebSocket connection: ${connectionError}`);
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
            // Check if connected first
            if (!this.connected) {
                return reject(new Error('Not connected to orchestrator. Please ensure connection is established before sending messages.'));
            }
            // Validate message has an ID
            if (!message.id) {
                return reject(new Error('Message must have an ID to wait for response'));
            }
            // Set up timeout
            const timer = setTimeout(() => {
                if (this.pendingResponses.has(message.id)) {
                    this.pendingResponses.delete(message.id);
                    this.logger.warn(`Request ${message.id} (${message.type}) timed out after ${timeout}ms`);
                    reject(new Error(`Request timed out after ${timeout}ms. Type: ${message.type}`));
                }
            }, timeout);
            // Store the pending response handlers
            this.pendingResponses.set(message.id, { resolve, reject, timer });
            // Send the message
            this.send(message).catch(error => {
                clearTimeout(timer);
                this.pendingResponses.delete(message.id);
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to send message ${message.id} (${message.type}): ${errorMessage}`);
                reject(error instanceof Error
                    ? error
                    : new Error(`Failed to send message: ${errorMessage}`));
            });
        });
    }
    /**
     * Send a request message and wait for a response
     * @param message - The message to send
     * @param options - Additional options
     * @param options.timeout - Timeout in milliseconds
     * @param options.customEvent - Custom event type to wait for (if specified, only messages with this event type will resolve)
     * @param options.anyMessageId - If true, resolve for any message with the custom event type, regardless of message ID
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
        const customEvent = options.customEvent;
        const anyMessageId = options.anyMessageId;
        // Validate options
        if (anyMessageId && !customEvent) {
            throw new Error('anyMessageId option requires customEvent to be specified');
        }
        this.logger.debug(`Sending request with ID ${messageId} (${message.type})${customEvent ? ` waiting for custom event: ${customEvent}` : ''}${anyMessageId ? ' (any message ID)' : ''}`);
        return new Promise((resolve, reject) => {
            let timer;
            // Always set up timeout using the computed timeout value
            timer = setTimeout(() => {
                if (this.pendingResponses.has(messageId)) {
                    this.pendingResponses.delete(messageId);
                    this.logger.warn(`Request ${messageId} (${message.type}) timed out after ${timeout}ms`);
                    reject(new Error(`Request timed out after ${timeout}ms. Type: ${message.type}`));
                }
            }, timeout);
            // Store the pending response handlers
            this.pendingResponses.set(messageId, {
                resolve,
                reject,
                timer,
                customEvent,
                anyMessageId
            });
            // Send the message
            this.send(message).catch(error => {
                // Clean up on send error
                if (timer) {
                    clearTimeout(timer);
                }
                this.pendingResponses.delete(messageId);
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to send message ${messageId} (${message.type}): ${errorMessage}`);
                reject(error instanceof Error
                    ? error
                    : new Error(`Failed to send message: ${errorMessage}`));
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
            const pendingResponse = this.pendingResponses.get(requestId);
            if (pendingResponse.timer) {
                clearTimeout(pendingResponse.timer);
            }
            this.pendingResponses.delete(requestId);
            if (isError) {
                pendingResponse.reject(new Error(message.content ? message.content.error : 'Unknown error'));
            }
            else {
                pendingResponse.resolve(message);
            }
            this.logger.debug(`Resolved pending response for message ID: ${requestId}${pendingResponse.customEvent ? ` with custom event: ${pendingResponse.customEvent}` : ''}`);
            return true;
        }
        return false;
    }
}
exports.WebSocketManager = WebSocketManager;
