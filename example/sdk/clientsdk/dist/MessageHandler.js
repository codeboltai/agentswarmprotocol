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
exports.MessageHandler = void 0;
var events_1 = require("events");
var uuid_1 = require("uuid");
/**
 * MessageHandler - Handles processing of messages from the orchestrator
 */
var MessageHandler = /** @class */ (function (_super) {
    __extends(MessageHandler, _super);
    /**
     * Create a new MessageHandler instance
     */
    function MessageHandler() {
        var _this = _super.call(this) || this;
        _this.pendingResponses = new Map();
        return _this;
    }
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    MessageHandler.prototype.handleMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, resolve, reject, timeout;
            return __generator(this, function (_b) {
                console.log("Client SDK received message: ".concat(JSON.stringify(message)));
                // Emit the message for custom handlers
                this.emit('message', message);
                // Check for pending responses
                if (message.id && this.pendingResponses.has(message.id)) {
                    _a = this.pendingResponses.get(message.id), resolve = _a.resolve, reject = _a.reject, timeout = _a.timeout;
                    clearTimeout(timeout);
                    this.pendingResponses.delete(message.id);
                    if (message.type === 'error' || (message.content && message.content.error)) {
                        reject(new Error(message.content ? message.content.error : 'Unknown error'));
                    }
                    else {
                        resolve(message);
                    }
                    console.log("Resolved pending response for message ID: ".concat(message.id));
                    return [2 /*return*/];
                }
                // Handle specific message types
                switch (message.type) {
                    case 'orchestrator.welcome':
                        this.emit('welcome', message.content);
                        break;
                    case 'agent.list':
                        this.emit('agent-list', message.content.agents);
                        break;
                    case 'mcp.server.list':
                        console.log('Emitting mcp-server-list event with servers:', JSON.stringify(message.content.servers));
                        this.emit('mcp-server-list', message.content.servers);
                        break;
                    case 'task.result':
                        this.emit('task-result', message.content);
                        break;
                    case 'task.status':
                        this.emit('task-status', message.content);
                        break;
                    case 'task.created':
                        this.emit('task-created', message.content);
                        break;
                    case 'task.notification':
                        // Handle task notifications
                        console.log("Received task notification: ".concat(message.content.message, " (").concat(message.content.notificationType, ")"));
                        this.emit('task-notification', message.content);
                        break;
                    case 'error':
                        console.error("Received error: ".concat(message.content ? message.content.error : 'Unknown error'));
                        this.emit('orchestrator-error', message.content || { error: 'Unknown error' });
                        break;
                    default:
                        console.log("Unhandled message type: ".concat(message.type));
                        break;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Send a message and wait for a response
     * @param message - The message to send
     * @param sendFunc - Function to send the message
     * @param options - Additional options
     * @returns The response message
     */
    MessageHandler.prototype.waitForResponse = function (message, sendFunc, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var timeout = options.timeout || 30000; // Default 30 second timeout
        // Add message ID if not present
        if (!message.id) {
            message.id = (0, uuid_1.v4)();
        }
        return new Promise(function (resolve, reject) {
            sendFunc(message)
                .then(function (messageId) {
                if (!messageId) {
                    return reject(new Error('Failed to send message'));
                }
                // Set timeout
                var timeoutId = setTimeout(function () {
                    if (_this.pendingResponses.has(messageId)) {
                        _this.pendingResponses.delete(messageId);
                        reject(new Error("Timeout waiting for response to message ".concat(messageId)));
                    }
                }, timeout);
                // Response callback
                _this.pendingResponses.set(messageId, {
                    resolve: resolve,
                    reject: reject,
                    timeout: timeoutId
                });
            })
                .catch(reject);
        });
    };
    /**
     * Clear all pending responses
     */
    MessageHandler.prototype.clearPendingResponses = function () {
        for (var _i = 0, _a = this.pendingResponses.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], _ = _b[0], timeout = _b[1].timeout;
            clearTimeout(timeout);
        }
        this.pendingResponses.clear();
    };
    return MessageHandler;
}(events_1.EventEmitter));
exports.MessageHandler = MessageHandler;
