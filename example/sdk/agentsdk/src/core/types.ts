import { BaseMessage, AgentStatus } from '@agentswarmprotocol/types/common';
import { AgentMessages } from '@agentswarmprotocol/types/messages';

// Use more specific types from agent messages
export type TaskExecuteMessage = AgentMessages.TaskExecuteMessage;

export interface PendingResponse {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timeout;
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
export type TaskHandler = (taskData: any, message: TaskExecuteMessage) => Promise<any>;

export interface ServiceTaskOptions {
  timeout?: number;
  onNotification?: (notification: any) => void;
  clientId?: string;
} 