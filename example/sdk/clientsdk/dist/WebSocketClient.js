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
exports.WebSocketClient = void 0;
var ws_1 = require("ws");
var events_1 = require("events");
/**
 * WebSocketClient - Handles WebSocket connection to the orchestrator
 */
var WebSocketClient = /** @class */ (function (_super) {
    __extends(WebSocketClient, _super);
    /**
     * Create a new WebSocketClient instance
     * @param config - Configuration options
     */
    function WebSocketClient(config) {
        if (config === void 0) { config = {}; }
        var _this = _super.call(this) || this;
        _this.orchestratorUrl = config.orchestratorUrl || process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';
        _this.autoReconnect = config.autoReconnect !== false;
        _this.reconnectInterval = config.reconnectInterval || 5000;
        _this.connected = false;
        _this.clientId = null;
        _this.ws = null;
        return _this;
    }
    /**
     * Connect to the orchestrator client interface
     * @returns Promise that resolves when connected
     */
    WebSocketClient.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.connected) {
                    return [2 /*return*/, Promise.resolve()];
                }
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        try {
                            console.log("Connecting to orchestrator at ".concat(_this.orchestratorUrl));
                            // Create WebSocket connection
                            _this.ws = new ws_1.default(_this.orchestratorUrl);
                            // Set up event listeners
                            _this.ws.on('open', function () {
                                console.log('Connected to orchestrator');
                                _this.connected = true;
                                _this.emit('connected');
                                resolve();
                            });
                            _this.ws.on('message', function (data) { return __awaiter(_this, void 0, void 0, function () {
                                var message;
                                return __generator(this, function (_a) {
                                    try {
                                        message = JSON.parse(data.toString());
                                        this.emit('message', message);
                                    }
                                    catch (error) {
                                        console.error('Error handling message:', error);
                                        this.emit('error', error);
                                    }
                                    return [2 /*return*/];
                                });
                            }); });
                            _this.ws.on('error', function (error) {
                                console.error('WebSocket error:', error);
                                _this.emit('error', error);
                                reject(error);
                            });
                            _this.ws.on('close', function () {
                                console.log('Disconnected from orchestrator');
                                _this.connected = false;
                                _this.emit('disconnected');
                                // Attempt to reconnect if enabled
                                if (_this.autoReconnect) {
                                    console.log("Attempting to reconnect in ".concat(_this.reconnectInterval / 1000, " seconds..."));
                                    setTimeout(function () { return _this.connect().catch(function (err) {
                                        console.error('Reconnection error:', err);
                                    }); }, _this.reconnectInterval);
                                }
                            });
                        }
                        catch (error) {
                            console.error('Connection error:', error);
                            reject(error);
                        }
                    })];
            });
        });
    };
    /**
     * Send a message to the orchestrator
     * @param message - The message to send
     * @returns The message ID or null if not sent
     */
    WebSocketClient.prototype.send = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        if (!_this.connected) {
                            return reject(new Error('Not connected to orchestrator'));
                        }
                        try {
                            if (_this.ws && _this.ws.readyState === ws_1.default.OPEN) {
                                _this.ws.send(JSON.stringify(message), function (err) {
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
                    })];
            });
        });
    };
    /**
     * Disconnect from the orchestrator
     */
    WebSocketClient.prototype.disconnect = function () {
        if (this.ws) {
            this.autoReconnect = false; // Disable reconnection
            this.ws.close();
            console.log('Disconnected from orchestrator');
        }
    };
    /**
     * Get the connection status
     * @returns Whether the client is connected
     */
    WebSocketClient.prototype.isConnected = function () {
        return this.connected;
    };
    /**
     * Get the client ID
     * @returns The client ID or null if not connected
     */
    WebSocketClient.prototype.getClientId = function () {
        return this.clientId;
    };
    /**
     * Set the client ID
     * @param clientId - The client ID
     */
    WebSocketClient.prototype.setClientId = function (clientId) {
        this.clientId = clientId;
    };
    return WebSocketClient;
}(events_1.EventEmitter));
exports.WebSocketClient = WebSocketClient;
