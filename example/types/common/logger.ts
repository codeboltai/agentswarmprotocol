/**
 * Logger Types for Agent Swarm Protocol
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Message direction enumeration for logging
 */
export enum MessageDirection {
  AGENT_TO_ORCHESTRATOR = 'agent->orchestrator',
  ORCHESTRATOR_TO_AGENT = 'orchestrator->agent',
  CLIENT_TO_ORCHESTRATOR = 'client->orchestrator',
  ORCHESTRATOR_TO_CLIENT = 'orchestrator->client',
  SERVICE_TO_ORCHESTRATOR = 'service->orchestrator',
  ORCHESTRATOR_TO_SERVICE = 'orchestrator->service',
  AGENT_TO_AGENT = 'agent->agent',
  INTERNAL = 'internal',
  MCP = 'mcp',
  SYSTEM = 'system'
} 