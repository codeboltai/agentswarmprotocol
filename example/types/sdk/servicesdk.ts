/**
 * Service SDK Type Definitions for Agent Swarm Protocol
 */

import { BaseMessage } from '../common';
import { ServiceMessages } from '../messages';

/**
 * Service task execute message type from service messages
 */
export type ServiceTaskExecuteMessage = ServiceMessages.ServiceTaskExecuteMessage;

/**
 * Service notification type from service messages
 */
export type ServiceNotificationType = ServiceMessages.ServiceNotificationType;

/**
 * Service tool interface
 */
export interface ServiceTool {
  /** Tool ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema */
  inputSchema?: Record<string, any>;
  /** Output schema */
  outputSchema?: Record<string, any>;
  /** Tool metadata */
  metadata?: Record<string, any>;
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  /** Service ID */
  serviceId?: string;
  /** Service name */
  name?: string;
  /** Service capabilities */
  capabilities?: string[];
  /** Service tools */
  tools?: ServiceTool[];
  /** Service description */
  description?: string;
  /** Service manifest */
  manifest?: Record<string, any>;
  /** Orchestrator URL */
  orchestratorUrl?: string;
  /** Auto reconnect flag */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Logger instance */
  logger?: Console;
}

/**
 * Pending response interface for service SDK
 */
export interface ServicePendingResponse {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Service notification interface
 */
export interface ServiceNotification {
  /** Task ID */
  taskId: string;
  /** Notification message */
  message: string;
  /** Notification type */
  type: ServiceNotificationType;
  /** Timestamp */
  timestamp: string;
  /** Additional data */
  data?: any;
}

/**
 * Task handler type for services
 */
export type ServiceTaskHandler = (params: any, message: ServiceTaskExecuteMessage) => Promise<any>; 