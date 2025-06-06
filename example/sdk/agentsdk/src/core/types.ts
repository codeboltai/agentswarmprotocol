// Import and re-export agent-specific types from the centralized types package
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { AgentMessages } from '@agentswarmprotocol/types/messages';

// Re-export types from centralized package
export type TaskExecuteMessage = AgentMessages.TaskExecuteMessage;

export interface PendingResponse {
  resolve: (value: BaseMessage) => void;
  reject: (reason?: any) => void;
  timer?: NodeJS.Timeout;
  customEvent?: string;
  anyMessageId?: boolean;
}

export interface AgentConfig {
  agentId?: string;
  name?: string;
  agentType?: string;
  capabilities?: string[];
  description?: string;
  manifest?: Record<string, any>;
  orchestratorUrl?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  logger?: Console;
}

export type MessageHandler = (content: any, message: BaseMessage) => void;
export type AgentTaskHandler = (taskData: any, message: TaskExecuteMessage) => Promise<any>;

export interface ServiceTaskOptions {
  timeout?: number;
}

// Alias for backward compatibility
export type AgentPendingResponse = PendingResponse; 