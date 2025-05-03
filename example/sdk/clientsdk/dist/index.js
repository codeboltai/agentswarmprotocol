"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPManager = exports.AgentManager = exports.TaskManager = exports.MessageHandler = exports.WebSocketClient = exports.SwarmClientSDK = void 0;
var events_1 = require("events");
var uuid_1 = require("uuid");
var WebSocketClient_1 = require("./WebSocketClient");
Object.defineProperty(exports, "WebSocketClient", { enumerable: true, get: function () { return WebSocketClient_1.WebSocketClient; } });
var MessageHandler_1 = require("./MessageHandler");
Object.defineProperty(exports, "MessageHandler", { enumerable: true, get: function () { return MessageHandler_1.MessageHandler; } });
var TaskManager_1 = require("./TaskManager");
Object.defineProperty(exports, "TaskManager", { enumerable: true, get: function () { return TaskManager_1.TaskManager; } });
var AgentManager_1 = require("./AgentManager");
Object.defineProperty(exports, "AgentManager", { enumerable: true, get: function () { return AgentManager_1.AgentManager; } });
var MCPManager_1 = require("./MCPManager");
Object.defineProperty(exports, "MCPManager", { enumerable: true, get: function () { return MCPManager_1.MCPManager; } });
/**
 * SwarmClientSDK - Client SDK for Agent Swarm Protocol
 * Handles client-side communication with the orchestrator
 */
var SwarmClientSDK = /** @class */ (function (_super) {
    __extends(SwarmClientSDK, _super);
    /**
     * Create a new SwarmClientSDK instance
     * @param config - Configuration options
     */
    function SwarmClientSDK(config) {
        if (config === void 0) { config = {}; }
        var _this = _super.call(this) || this;
        _this.clientId = null;
        _this.defaultTimeout = config.defaultTimeout || 30000;
        // Initialize WebSocket client
        _this.wsClient = new WebSocketClient_1.WebSocketClient(config);
        // Initialize message handler
        _this.messageHandler = new MessageHandler_1.MessageHandler();
        // Initialize managers
        _this.tasks = new TaskManager_1.TaskManager(_this.sendRequest.bind(_this));
        _this.agents = new AgentManager_1.AgentManager(_this.sendRequest.bind(_this));
        _this.mcp = new MCPManager_1.MCPManager(_this.sendRequest.bind(_this));
        // Set up event forwarding
        _this.wsClient.on('message', function (message) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.messageHandler.handleMessage(message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        _this.wsClient.on('connected', function () {
            _this.emit('connected');
        });
        _this.wsClient.on('disconnected', function () {
            _this.emit('disconnected');
        });
        _this.wsClient.on('error', function (error) {
            _this.emit('error', error);
        });
        // Forward events from message handler
        _this.messageHandler.on('welcome', function (content) {
            if (content.clientId) {
                _this.clientId = content.clientId;
                _this.wsClient.setClientId(content.clientId);
            }
            _this.emit('welcome', content);
        });
        // Set up event forwarding for task manager
        _this.tasks.registerEventListeners(_this.messageHandler);
        // Set up event forwarding for agent manager
        _this.agents.registerEventListeners(_this.messageHandler);
        // Set up event forwarding for MCP manager
        _this.mcp.registerEventListeners(_this.messageHandler);
        // Forward remaining events
        _this.messageHandler.on('orchestrator-error', function (error) {
            _this.emit('orchestrator-error', error);
        });
        return _this;
    }
    /**
     * Connect to the orchestrator
     * @returns Promise that resolves when connected
     */
    SwarmClientSDK.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.wsClient.connect()];
            });
        });
    };
    /**
     * Disconnect from the orchestrator
     */
    SwarmClientSDK.prototype.disconnect = function () {
        this.wsClient.disconnect();
        this.messageHandler.clearPendingResponses();
    };
    /**
     * Check if connected to the orchestrator
     * @returns Whether the client is connected
     */
    SwarmClientSDK.prototype.isConnected = function () {
        return this.wsClient.isConnected();
    };
    /**
     * Get the client ID
     * @returns The client ID or null if not connected
     */
    SwarmClientSDK.prototype.getClientId = function () {
        return this.clientId;
    };
    /**
     * Send a request to the orchestrator
     * @param message - The message to send
     * @param options - Additional options
     * @returns The response message
     */
    SwarmClientSDK.prototype.sendRequest = function (message_1) {
        return __awaiter(this, arguments, void 0, function (message, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                // Set message ID if not set
                if (!message.id) {
                    message.id = (0, uuid_1.v4)();
                }
                // Set timestamp if not set
                if (!message.timestamp) {
                    message.timestamp = new Date().toISOString();
                }
                // Wait for response
                return [2 /*return*/, this.messageHandler.waitForResponse(message, function (msg) { return _this.wsClient.send(msg); }, { timeout: options.timeout || this.defaultTimeout })];
            });
        });
    };
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    SwarmClientSDK.prototype.sendTask = function (agentName_1, taskData_1) {
        return __awaiter(this, arguments, void 0, function (agentName, taskData, options) {
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.tasks.sendTask(agentName, taskData, options)];
            });
        });
    };
    /**
     * Get a list of all registered agents
     * @param filters - Optional filters to apply to the agent list
     * @returns Array of agent objects
     */
    SwarmClientSDK.prototype.getAgents = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.agents.getAgents(filters)];
            });
        });
    };
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    SwarmClientSDK.prototype.listMCPServers = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.mcp.listMCPServers(filters)];
            });
        });
    };
    return SwarmClientSDK;
}(events_1.EventEmitter));
exports.SwarmClientSDK = SwarmClientSDK;
__exportStar(require("./WebSocketClient"), exports);
__exportStar(require("./MessageHandler"), exports);
__exportStar(require("./TaskManager"), exports);
__exportStar(require("./AgentManager"), exports);
__exportStar(require("./MCPManager"), exports);
