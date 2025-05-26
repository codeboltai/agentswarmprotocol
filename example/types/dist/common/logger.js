"use strict";
/**
 * Logger Types for Agent Swarm Protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageDirection = exports.LogLevel = void 0;
/**
 * Log level enumeration
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Message direction enumeration for logging
 */
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
