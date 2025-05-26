"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.MessageDirection = exports.LogLevel = void 0;
const chalk_1 = __importDefault(require("chalk"));
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var MessageDirection;
(function (MessageDirection) {
    MessageDirection["AGENT_TO_ORCHESTRATOR"] = "agent->orchestrator";
    MessageDirection["ORCHESTRATOR_TO_AGENT"] = "orchestrator->agent";
    MessageDirection["CLIENT_TO_ORCHESTRATOR"] = "client->orchestrator";
    MessageDirection["ORCHESTRATOR_TO_CLIENT"] = "orchestrator->client";
    MessageDirection["SERVICE_TO_ORCHESTRATOR"] = "service->orchestrator";
    MessageDirection["ORCHESTRATOR_TO_SERVICE"] = "orchestrator->service";
    MessageDirection["AGENT_TO_AGENT"] = "agent->agent";
    MessageDirection["INTERNAL"] = "internal";
    MessageDirection["MCP"] = "mcp";
    MessageDirection["SYSTEM"] = "system";
})(MessageDirection || (exports.MessageDirection = MessageDirection = {}));
class Logger {
    constructor() {
        this.logLevel = LogLevel.INFO;
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    shouldLog(level) {
        const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    }
    getDirectionColor(direction) {
        switch (direction) {
            case MessageDirection.AGENT_TO_ORCHESTRATOR:
                return chalk_1.default.cyan;
            case MessageDirection.ORCHESTRATOR_TO_AGENT:
                return chalk_1.default.blue;
            case MessageDirection.CLIENT_TO_ORCHESTRATOR:
                return chalk_1.default.green;
            case MessageDirection.ORCHESTRATOR_TO_CLIENT:
                return chalk_1.default.magenta;
            case MessageDirection.SERVICE_TO_ORCHESTRATOR:
                return chalk_1.default.yellow;
            case MessageDirection.ORCHESTRATOR_TO_SERVICE:
                return chalk_1.default.yellowBright;
            case MessageDirection.AGENT_TO_AGENT:
                return chalk_1.default.cyanBright;
            case MessageDirection.MCP:
                return chalk_1.default.redBright;
            case MessageDirection.INTERNAL:
                return chalk_1.default.gray;
            case MessageDirection.SYSTEM:
                return chalk_1.default.greenBright;
            default:
                return chalk_1.default.white;
        }
    }
    getLogLevelColor(level) {
        switch (level) {
            case LogLevel.ERROR:
                return chalk_1.default.red;
            case LogLevel.WARN:
                return chalk_1.default.yellow;
            case LogLevel.INFO:
                return chalk_1.default.blue;
            case LogLevel.DEBUG:
                return chalk_1.default.gray;
            default:
                return chalk_1.default.white;
        }
    }
    formatTimestamp() {
        return chalk_1.default.gray(`[${new Date().toISOString()}]`);
    }
    formatDirection(direction) {
        const color = this.getDirectionColor(direction);
        return color(`[${direction}]`);
    }
    formatLogLevel(level) {
        const color = this.getLogLevelColor(level);
        return color(`[${level.toUpperCase()}]`);
    }
    log(level, direction, message, data, entityId) {
        if (!this.shouldLog(level)) {
            return;
        }
        const timestamp = this.formatTimestamp();
        const directionFormatted = this.formatDirection(direction);
        const levelFormatted = this.formatLogLevel(level);
        let entityInfo = '';
        if (entityId) {
            entityInfo = chalk_1.default.dim(`[${entityId}]`);
        }
        const logMessage = `${directionFormatted} ${levelFormatted} ${entityInfo} ${message}`;
        console.log(logMessage);
        if (data && this.logLevel === LogLevel.DEBUG) {
            console.log(chalk_1.default.dim('  Data:'), JSON.stringify(data, null, 2));
        }
    }
    // Convenience methods for different directions
    agentToOrchestrator(message, data, agentId) {
        this.log(LogLevel.INFO, MessageDirection.AGENT_TO_ORCHESTRATOR, message, data, agentId);
    }
    orchestratorToAgent(message, data, agentId) {
        this.log(LogLevel.INFO, MessageDirection.ORCHESTRATOR_TO_AGENT, message, data, agentId);
    }
    clientToOrchestrator(message, data, clientId) {
        this.log(LogLevel.INFO, MessageDirection.CLIENT_TO_ORCHESTRATOR, message, data, clientId);
    }
    orchestratorToClient(message, data, clientId) {
        this.log(LogLevel.INFO, MessageDirection.ORCHESTRATOR_TO_CLIENT, message, data, clientId);
    }
    serviceToOrchestrator(message, data, serviceId) {
        this.log(LogLevel.INFO, MessageDirection.SERVICE_TO_ORCHESTRATOR, message, data, serviceId);
    }
    orchestratorToService(message, data, serviceId) {
        this.log(LogLevel.INFO, MessageDirection.ORCHESTRATOR_TO_SERVICE, message, data, serviceId);
    }
    agentToAgent(message, data, fromAgentId, toAgentId) {
        const entityId = fromAgentId && toAgentId ? `${fromAgentId}->${toAgentId}` : fromAgentId || toAgentId;
        this.log(LogLevel.INFO, MessageDirection.AGENT_TO_AGENT, message, data, entityId);
    }
    mcp(message, data, serverId) {
        this.log(LogLevel.INFO, MessageDirection.MCP, message, data, serverId);
    }
    internal(message, data) {
        this.log(LogLevel.INFO, MessageDirection.INTERNAL, message, data);
    }
    system(message, data) {
        this.log(LogLevel.INFO, MessageDirection.SYSTEM, message, data);
    }
    error(direction, message, error, entityId) {
        this.log(LogLevel.ERROR, direction, message, error, entityId);
    }
    warn(direction, message, data, entityId) {
        this.log(LogLevel.WARN, direction, message, data, entityId);
    }
    debug(direction, message, data, entityId) {
        this.log(LogLevel.DEBUG, direction, message, data, entityId);
    }
    // Connection status logging
    connection(direction, status, entityId) {
        const statusColor = status === 'connected' ? chalk_1.default.green : chalk_1.default.red;
        const message = `${statusColor(status.toUpperCase())} - ${entityId}`;
        this.log(LogLevel.INFO, direction, message, undefined, entityId);
    }
    // Task flow logging
    taskFlow(direction, action, taskId, fromEntity, toEntity) {
        let entityInfo = taskId;
        if (fromEntity && toEntity) {
            entityInfo = `${fromEntity}->${toEntity}:${taskId}`;
        }
        else if (fromEntity || toEntity) {
            entityInfo = `${fromEntity || toEntity}:${taskId}`;
        }
        this.log(LogLevel.INFO, direction, `Task ${action}`, undefined, entityInfo);
    }
    // Message type logging
    messageType(direction, messageType, entityId, additionalInfo) {
        const message = `Message: ${chalk_1.default.bold(messageType)}${additionalInfo ? ` - ${additionalInfo}` : ''}`;
        this.log(LogLevel.INFO, direction, message, undefined, entityId);
    }
}
exports.Logger = Logger;
// Export singleton instance
exports.logger = Logger.getInstance();
