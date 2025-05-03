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
exports.MCPClient = void 0;
const child_process_1 = require("child_process");
const uuid_1 = require("uuid");
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
/**
 * MCPClient - Client implementation for Model Context Protocol
 * Handles communication with MCP servers using stdin/stdout transport
 */
class MCPClient {
    constructor(serverConfig) {
        this.config = serverConfig;
        this.process = null;
        this.stdin = null;
        this.stdout = null;
        this.requestCallbacks = new Map();
        this.tools = [];
        this.initialized = false;
        this.connectionId = (0, uuid_1.v4)();
    }
    /**
     * Connect to the MCP server
     * @returns {Promise<Array>} List of available tools
     */
    async connect() {
        if (this.process) {
            console.log('MCP client already connected, disconnecting first');
            await this.disconnect();
        }
        try {
            // Determine command based on server type
            let command;
            let args;
            switch (this.config.type.toLowerCase()) {
                case 'python':
                    command = 'python';
                    args = [this.config.path || ''];
                    break;
                case 'node':
                    command = 'node';
                    args = [this.config.path || ''];
                    break;
                default:
                    throw new Error(`Unsupported server type: ${this.config.type}`);
            }
            if (!this.config.path) {
                throw new Error('Server path is required');
            }
            console.log(`Starting MCP server: ${command} ${args.join(' ')}`);
            // Spawn the server process
            this.process = (0, child_process_1.spawn)(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.dirname(this.config.path)
            });
            if (!this.process.stdin || !this.process.stdout) {
                throw new Error('Failed to initialize process streams');
            }
            this.stdin = this.process.stdin;
            this.stdout = this.process.stdout;
            // Set up process event handlers
            this.process.on('error', (error) => {
                console.error(`MCP Server process error:`, error);
                this.handleError(error);
            });
            this.process.on('exit', (code, signal) => {
                console.log(`MCP Server process exited: code=${code}, signal=${signal}`);
                this.process = null;
                this.stdin = null;
                this.stdout = null;
                this.initialized = false;
            });
            // Set up message handling
            this.setupMessageHandling();
            // Initialize the MCP protocol session
            await this.initialize();
            // List available tools
            this.tools = await this.listTools();
            return this.tools;
        }
        catch (error) {
            console.error('Failed to connect to MCP server:', error);
            throw error;
        }
    }
    /**
     * Set up message handling for MCP communication
     */
    setupMessageHandling() {
        if (!this.stdout) {
            throw new Error('Cannot setup message handling: stdout is null');
        }
        const rl = readline.createInterface({
            input: this.stdout,
            terminal: false
        });
        rl.on('line', (line) => {
            try {
                if (!line.trim())
                    return;
                const message = JSON.parse(line);
                this.handleMessage(message);
            }
            catch (error) {
                console.error('Error parsing message from MCP server:', error);
                console.error('Raw message:', line);
            }
        });
        if (this.process && this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                console.error(`MCP Server stderr: ${data.toString()}`);
            });
        }
    }
    /**
     * Handle an incoming message from the MCP server
     * @param {MCPMessage} message - The received message
     */
    handleMessage(message) {
        if (!message.id) {
            console.warn('Received message without ID from MCP server:', message);
            return;
        }
        const callback = this.requestCallbacks.get(message.id);
        if (callback) {
            callback(message);
            this.requestCallbacks.delete(message.id);
        }
        else {
            console.warn(`No callback found for message ID: ${message.id}`);
        }
    }
    /**
     * Handle an error in the MCP communication
     * @param {Error} error - The error that occurred
     */
    handleError(error) {
        // Notify all pending requests about the error
        Array.from(this.requestCallbacks.entries()).forEach(([id, callback]) => {
            callback({ error: error.message, id });
            this.requestCallbacks.delete(id);
        });
    }
    /**
     * Send a message to the MCP server and wait for response
     * @param {MCPMessage} message - The message to send
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<MCPMessage>} The server response
     */
    async sendMessage(message, timeout = 30000) {
        if (!this.process || !this.stdin) {
            throw new Error('MCP client not connected');
        }
        return new Promise((resolve, reject) => {
            const messageId = message.id || (0, uuid_1.v4)();
            const messageWithId = { ...message, id: messageId };
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.requestCallbacks.delete(messageId);
                reject(new Error(`Request timed out after ${timeout}ms: ${messageId}`));
            }, timeout);
            // Set up callback
            this.requestCallbacks.set(messageId, (response) => {
                clearTimeout(timeoutId);
                if (response.error) {
                    reject(new Error(response.error));
                }
                else {
                    resolve(response);
                }
            });
            // Send the message
            try {
                const messageStr = JSON.stringify(messageWithId) + '\n';
                if (this.stdin) {
                    this.stdin.write(messageStr, 'utf8');
                }
                else {
                    throw new Error('stdin is null');
                }
            }
            catch (error) {
                clearTimeout(timeoutId);
                this.requestCallbacks.delete(messageId);
                reject(error);
            }
        });
    }
    /**
     * Initialize the MCP protocol session
     * @returns {Promise<MCPMessage>} Initialization result
     */
    async initialize() {
        try {
            const response = await this.sendMessage({
                type: 'initialize',
                version: '1.0'
            });
            this.initialized = true;
            return response;
        }
        catch (error) {
            console.error('Failed to initialize MCP session:', error);
            throw error;
        }
    }
    /**
     * List available tools from the MCP server
     * @returns {Promise<MCPTool[]>} List of available tools
     */
    async listTools() {
        try {
            const response = await this.sendMessage({
                type: 'list_tools'
            });
            return response.tools || [];
        }
        catch (error) {
            console.error('Failed to list MCP tools:', error);
            throw error;
        }
    }
    /**
     * Call a tool on the MCP server
     * @param {string} toolName - Name of the tool to call
     * @param {Record<string, any>} toolArgs - Arguments for the tool
     * @returns {Promise<Object>} Tool execution result
     */
    async callTool(toolName, toolArgs) {
        try {
            const response = await this.sendMessage({
                type: 'tool_call',
                tool: {
                    name: toolName,
                    args: toolArgs
                }
            });
            return {
                result: response.result,
                metadata: response.metadata || {}
            };
        }
        catch (error) {
            console.error(`Failed to call MCP tool ${toolName}:`, error);
            throw error;
        }
    }
    /**
     * Execute a tool on the MCP server (alias for callTool)
     * @param {string} toolName - Name of the tool to execute
     * @param {Record<string, any>} toolArgs - Arguments for the tool
     * @returns {Promise<any>} Tool execution result
     */
    async executeTool(toolName, toolArgs) {
        const result = await this.callTool(toolName, toolArgs);
        return result.result;
    }
    /**
     * Get the list of available tools
     * @returns {MCPTool[]} List of available tools
     */
    getTools() {
        return this.tools;
    }
    /**
     * Disconnect from the MCP server
     */
    async disconnect() {
        if (!this.process) {
            console.log('MCP client already disconnected');
            return;
        }
        try {
            // Try to send a clean shutdown message
            if (this.stdin && this.initialized) {
                try {
                    await this.sendMessage({ type: 'shutdown' }, 2000);
                }
                catch (error) {
                    console.warn('Error sending shutdown message:', error.message);
                }
            }
            // Kill the process
            this.process.kill();
            // Clean up
            this.process = null;
            this.stdin = null;
            this.stdout = null;
            this.initialized = false;
        }
        catch (error) {
            console.error('Error disconnecting from MCP server:', error);
        }
    }
}
exports.MCPClient = MCPClient;
