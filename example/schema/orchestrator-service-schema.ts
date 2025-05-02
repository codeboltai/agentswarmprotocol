/**
 * Agent Swarm Protocol - Orchestrator ⟷ Service Communication Schema
 * 
 * This file defines the TypeScript interfaces for messages exchanged between 
 * the orchestrator and services. It covers both messages sent from the orchestrator
 * to services and from services to the orchestrator.
 */

/**
 * Base interface for all messages
 */
export interface BaseMessage {
  /** Unique identifier for the message */
  id: string;
  /** Type of message that indicates its purpose */
  type: string;
  /** Optional timestamp of when the message was created */
  timestamp?: string;
  /** Optional request ID when this message is a response to a request */
  requestId?: string;
  /** Main content of the message, structure varies by message type */
  content: any;
}

/**
 * Possible service statuses
 */
export type ServiceStatus = 'online' | 'offline' | 'busy' | 'error' | 'initializing';

/**
 * Service task status types
 */
export type ServiceTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Notification type for service task notifications
 */
export type ServiceNotificationType = 'progress' | 'info' | 'warning' | 'error' | 'debug';

// ==========================================
// Orchestrator -> Service Message Types
// ==========================================

/**
 * Welcome message sent to service on connection
 */
export interface OrchestratorWelcomeMessage extends BaseMessage {
  type: 'orchestrator.welcome';
  content: {
    /** Orchestrator version */
    version: string;
    /** Message of the day or welcome text */
    message?: string;
    /** Any configuration settings to apply */
    config?: Record<string, any>;
  };
}

/**
 * Response to a service registration
 */
export interface ServiceRegisteredMessage extends BaseMessage {
  type: 'service.registered';
  content: {
    /** Assigned service ID */
    serviceId: string;
    /** Service name */
    name: string;
    /** Success message */
    message: string;
  };
}

/**
 * Message to execute a service task
 */
export interface ServiceTaskExecuteMessage extends BaseMessage {
  type: 'service.task.execute';
  content: {
    /** Name of the function to execute */
    functionName: string;
    /** Function parameters */
    params?: any;
    /** Task metadata */
    metadata?: {
      /** ID of the agent that requested this task */
      agentId?: string;
      /** ID of the client associated with this task */
      clientId?: string;
      /** Timestamp of when the task was created */
      timestamp?: string;
      /** Any additional metadata */
      [key: string]: any;
    };
    /** Additional task-specific data */
    [key: string]: any;
  };
}

/**
 * Response to a service notification
 */
export interface NotificationReceivedMessage extends BaseMessage {
  type: 'notification.received';
  content: {
    /** Confirmation message */
    message: string;
    /** ID of the notification that was received */
    notificationId: string;
  };
}

/**
 * Ping message to check service connectivity
 */
export interface PingMessage extends BaseMessage {
  type: 'ping';
  content: {
    /** Timestamp when ping was sent */
    timestamp: string;
  };
}

/**
 * Error message from orchestrator
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  content: {
    /** Error message */
    error: string;
    /** Optional error code */
    code?: string;
    /** Optional stack trace */
    stack?: string;
  };
}

/**
 * Response to a service status update
 */
export interface ServiceStatusUpdatedMessage extends BaseMessage {
  type: 'service.status.updated';
  content: {
    /** New service status */
    status: ServiceStatus;
    /** Optional message */
    message?: string;
  };
}

// ==========================================
// Service -> Orchestrator Message Types
// ==========================================

/**
 * Service registration message
 */
export interface ServiceRegisterMessage extends BaseMessage {
  type: 'service.register';
  content: {
    /** Service name */
    name: string;
    /** Service capabilities */
    capabilities?: string[];
    /** Service manifest with additional information */
    manifest?: {
      /** Service description */
      description?: string;
      /** Version information */
      version?: string;
      /** Whether this service can send notifications */
      supportsNotifications?: boolean;
      /** Any additional metadata */
      [key: string]: any;
    };
  };
}

/**
 * Service task result message
 */
export interface ServiceTaskResultMessage extends BaseMessage {
  type: 'service.task.result';
  /** The ID of the task this is a result for */
  taskId: string;
  content: {
    /** Task result data */
    [key: string]: any;
  };
}

/**
 * Service task notification message
 */
export interface ServiceTaskNotificationMessage extends BaseMessage {
  type: 'service.task.notification';
  content: {
    /** ID of the task this notification is related to */
    taskId: string;
    /** Type of notification */
    notificationType: ServiceNotificationType;
    /** Notification message */
    message: string;
    /** Additional notification data */
    data?: any;
    /** Notification level */
    level?: 'info' | 'warning' | 'error' | 'debug';
    /** When the notification was created */
    timestamp: string;
  };
}

/**
 * Service status update message
 */
export interface ServiceStatusUpdateMessage extends BaseMessage {
  type: 'service.status.update';
  content: {
    /** New service status */
    status: ServiceStatus;
    /** Optional message explaining the status change */
    message?: string;
  };
}

/**
 * Service error message
 */
export interface ServiceErrorMessage extends BaseMessage {
  type: 'service.error';
  content: {
    /** Error message */
    error: string;
    /** Optional error code */
    code?: string;
    /** Optional task ID if this error is related to a specific task */
    taskId?: string;
    /** Optional stack trace */
    stack?: string;
  };
}

/**
 * Pong response to a ping message
 */
export interface PongMessage extends BaseMessage {
  type: 'pong';
  content: {
    /** Timestamp when pong was sent */
    timestamp?: string;
  };
}

// ==========================================
// Core Data Types (not messages)
// ==========================================

/**
 * Service structure in the orchestrator
 */
export interface Service {
  /** Unique service ID */
  id: string;
  /** Service name */
  name: string;
  /** Connection ID for the WebSocket */
  connectionId: string;
  /** Current service status */
  status: string;
  /** Service capabilities/functions */
  capabilities: string[];
  /** When the service was registered */
  registeredAt: string;
  /** Additional service information */
  manifest?: {
    /** Service description */
    description?: string;
    /** Service version */
    version?: string;
    /** Whether this service can send notifications */
    supportsNotifications?: boolean;
    /** Additional metadata */
    metadata?: Record<string, any>;
    /** Any other fields */
    [key: string]: any;
  };
}

/**
 * Service task structure in the orchestrator
 */
export interface ServiceTask {
  /** Unique task ID */
  id: string;
  /** ID of the service assigned to this task */
  serviceId: string;
  /** ID of the agent that requested this task */
  agentId: string;
  /** ID of the client associated with this task */
  clientId?: string;
  /** Current task status */
  status: ServiceTaskStatus;
  /** When the task was created */
  createdAt: string;
  /** When the task was completed (if applicable) */
  completedAt?: string;
  /** Task data passed to the service */
  taskData: any;
  /** Task result returned by the service */
  result?: any;
  /** Error information if the task failed */
  error?: {
    /** Error message */
    message: string;
    /** Error code */
    code?: string;
    /** Stack trace or additional details */
    details?: any;
  };
}
