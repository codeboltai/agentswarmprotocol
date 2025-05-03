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
exports.TaskManager = void 0;
var events_1 = require("events");
/**
 * TaskManager - Handles task-related operations
 */
var TaskManager = /** @class */ (function (_super) {
    __extends(TaskManager, _super);
    /**
     * Create a new TaskManager instance
     * @param sendRequest - Function to send requests
     */
    function TaskManager(sendRequest) {
        var _this = _super.call(this) || this;
        _this.sendRequest = sendRequest;
        return _this;
    }
    /**
     * Send a task to an agent
     * @param agentName - Name of the agent to send the task to
     * @param taskData - Task data to send
     * @param options - Additional options
     * @returns Task information
     */
    TaskManager.prototype.sendTask = function (agentName_1, taskData_1) {
        return __awaiter(this, arguments, void 0, function (agentName, taskData, options) {
            var waitForResult, timeout, response, taskId;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        waitForResult = options.waitForResult !== false;
                        timeout = options.timeout || 60000;
                        console.log("Sending task to agent ".concat(agentName));
                        return [4 /*yield*/, this.sendRequest({
                                type: 'task.create',
                                content: {
                                    agentName: agentName,
                                    taskData: taskData
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        taskId = response.content.taskId;
                        if (!waitForResult) {
                            return [2 /*return*/, response.content];
                        }
                        // Wait for task result
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                var timeoutId = setTimeout(function () {
                                    cleanup();
                                    reject(new Error("Task timeout after ".concat(timeout, "ms: ").concat(taskId)));
                                }, timeout);
                                var resultHandler = function (result) {
                                    if (result.taskId === taskId) {
                                        cleanup();
                                        resolve(result);
                                    }
                                };
                                var statusHandler = function (status) {
                                    var _a;
                                    if (status.taskId === taskId && status.status === 'failed') {
                                        cleanup();
                                        reject(new Error("Task failed: ".concat(((_a = status.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error')));
                                    }
                                };
                                var cleanup = function () {
                                    clearTimeout(timeoutId);
                                    _this.removeListener('task-result', resultHandler);
                                    _this.removeListener('task-status', statusHandler);
                                };
                                _this.on('task-result', resultHandler);
                                _this.on('task-status', statusHandler);
                            })];
                }
            });
        });
    };
    /**
     * Get the status of a task
     * @param taskId - ID of the task to get status for
     * @returns Task status
     */
    TaskManager.prototype.getTaskStatus = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendRequest({
                            type: 'task.status',
                            content: {
                                taskId: taskId
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.content];
                }
            });
        });
    };
    /**
     * Register event listeners for task events
     * @param emitter - Event emitter to listen to
     */
    TaskManager.prototype.registerEventListeners = function (emitter) {
        var _this = this;
        emitter.on('task-created', function (data) {
            _this.emit('task-created', data);
        });
        emitter.on('task-status', function (data) {
            _this.emit('task-status', data);
        });
        emitter.on('task-result', function (data) {
            _this.emit('task-result', data);
        });
        emitter.on('task-notification', function (data) {
            _this.emit('task-notification', data);
        });
    };
    return TaskManager;
}(events_1.EventEmitter));
exports.TaskManager = TaskManager;
