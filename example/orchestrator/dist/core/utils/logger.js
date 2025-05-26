"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.MessageDirection = exports.LogLevel = void 0;
const chalk_1 = __importDefault(require("chalk"));
const common_1 = require("@agentswarmprotocol/types/common");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return common_1.LogLevel; } });
Object.defineProperty(exports, "MessageDirection", { enumerable: true, get: function () { return common_1.MessageDirection; } });
class Logger {
    constructor() {
        this.logLevel = common_1.LogLevel.INFO;
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
        const levels = [common_1.LogLevel.ERROR, common_1.LogLevel.WARN, common_1.LogLevel.INFO, common_1.LogLevel.DEBUG];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    }
    getDirectionColor(direction) {
        switch (direction) {
            case common_1.MessageDirection.AGENT_TO_ORCHESTRATOR:
                return chalk_1.default.cyan;
            case common_1.MessageDirection.ORCHESTRATOR_TO_AGENT:
                return chalk_1.default.blue;
            case common_1.MessageDirection.CLIENT_TO_ORCHESTRATOR:
                return chalk_1.default.green;
            case common_1.MessageDirection.ORCHESTRATOR_TO_CLIENT:
                return chalk_1.default.magenta;
            case common_1.MessageDirection.SERVICE_TO_ORCHESTRATOR:
                return chalk_1.default.yellow;
            case common_1.MessageDirection.ORCHESTRATOR_TO_SERVICE:
                return chalk_1.default.yellowBright;
            case common_1.MessageDirection.AGENT_TO_AGENT:
                return chalk_1.default.cyanBright;
            case common_1.MessageDirection.MCP:
                return chalk_1.default.redBright;
            case common_1.MessageDirection.INTERNAL:
                return chalk_1.default.gray;
            case common_1.MessageDirection.SYSTEM:
                return chalk_1.default.greenBright;
            default:
                return chalk_1.default.white;
        }
    }
    getLogLevelColor(level) {
        switch (level) {
            case common_1.LogLevel.ERROR:
                return chalk_1.default.red;
            case common_1.LogLevel.WARN:
                return chalk_1.default.yellow;
            case common_1.LogLevel.INFO:
                return chalk_1.default.blue;
            case common_1.LogLevel.DEBUG:
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
            entityInfo = chalk_1.default.magenta(`[${entityId}]`);
        }
        const logMessage = `${directionFormatted} ${levelFormatted} ${entityInfo} ${message}`;
        console.log(logMessage);
        if (data) {
            if (this.logLevel === common_1.LogLevel.DEBUG) {
                // Full detailed data in debug mode with gray formatting and better structure
                console.log(chalk_1.default.gray('  ┌─ Data:'));
                const formattedData = JSON.stringify(data, null, 2)
                    .split('\n')
                    .map((line, index, array) => {
                    const prefix = index === array.length - 1 ? '  └─ ' : '  │  ';
                    return chalk_1.default.gray(`${prefix}${line}`);
                })
                    .join('\n');
                console.log(formattedData);
            }
            else if (this.logLevel === common_1.LogLevel.INFO) {
                // Compact data display for info mode with gray formatting and visual separator
                const compactData = JSON.stringify(data);
                if (compactData.length > 100) {
                    // For longer data, format it nicely
                    console.log(chalk_1.default.gray('  ┌─ Data:'));
                    console.log(chalk_1.default.gray(`  └─ ${compactData}`));
                }
                else {
                    // For shorter data, keep it inline
                    console.log(chalk_1.default.gray(`  → ${compactData}`));
                }
            }
        }
    }
    // Convenience methods for different directions
    agentToOrchestrator(message, data, agentId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.AGENT_TO_ORCHESTRATOR, message, data, agentId);
    }
    orchestratorToAgent(message, data, agentId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.ORCHESTRATOR_TO_AGENT, message, data, agentId);
    }
    clientToOrchestrator(message, data, clientId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.CLIENT_TO_ORCHESTRATOR, message, data, clientId);
    }
    orchestratorToClient(message, data, clientId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.ORCHESTRATOR_TO_CLIENT, message, data, clientId);
    }
    serviceToOrchestrator(message, data, serviceId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.SERVICE_TO_ORCHESTRATOR, message, data, serviceId);
    }
    orchestratorToService(message, data, serviceId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.ORCHESTRATOR_TO_SERVICE, message, data, serviceId);
    }
    agentToAgent(message, data, fromAgentId, toAgentId) {
        const entityId = fromAgentId && toAgentId ? `${fromAgentId}->${toAgentId}` : fromAgentId || toAgentId;
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.AGENT_TO_AGENT, message, data, entityId);
    }
    mcp(message, data, serverId) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.MCP, message, data, serverId);
    }
    internal(message, data) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.INTERNAL, message, data);
    }
    system(message, data) {
        this.log(common_1.LogLevel.INFO, common_1.MessageDirection.SYSTEM, message, data);
    }
    error(direction, message, error, entityId) {
        this.log(common_1.LogLevel.ERROR, direction, message, error, entityId);
    }
    warn(direction, message, data, entityId) {
        this.log(common_1.LogLevel.WARN, direction, message, data, entityId);
    }
    debug(direction, message, data, entityId) {
        this.log(common_1.LogLevel.DEBUG, direction, message, data, entityId);
    }
    // Connection status logging
    connection(direction, status, entityId) {
        const statusColor = status === 'connected' ? chalk_1.default.green : chalk_1.default.red;
        const message = `${statusColor(status.toUpperCase())} - ${entityId}`;
        this.log(common_1.LogLevel.INFO, direction, message, undefined, entityId);
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
        this.log(common_1.LogLevel.INFO, direction, `Task ${action}`, undefined, entityInfo);
    }
    // Message type logging
    messageType(direction, messageType, entityId, additionalInfo) {
        const message = `Message: ${chalk_1.default.bold(messageType)}${additionalInfo ? ` - ${additionalInfo}` : ''}`;
        this.log(common_1.LogLevel.INFO, direction, message, undefined, entityId);
    }
}
exports.Logger = Logger;
// Export singleton instance
exports.logger = Logger.getInstance();
