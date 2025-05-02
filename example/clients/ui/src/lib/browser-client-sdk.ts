import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Define interfaces for better type safety
interface PendingResponse {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

interface ClientMessage {
  id?: string;
  type: string;
  content: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Browser-compatible version of the SwarmClientSDK
 */
export class BrowserClientSDK extends EventEmitter {
  orchestratorUrl: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  pendingResponses: Map<string, PendingResponse>;
  connected: boolean;
  clientId: string | null;
  ws: WebSocket | null;
  
  /**
   * Create a new BrowserClientSDK instance
   */
  constructor(config: {
    orchestratorUrl?: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    clientId?: string;
    autoConnect?: boolean;
  } = {}) {
    super();
    
    this.orchestratorUrl = config.orchestratorUrl || 'ws://localhost:3001';
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.pendingResponses = new Map();
    this.connected = false;
    this.clientId = config.clientId || null;
    this.ws = null;
    
    // Auto-connect if configured
    if (config.autoConnect) {
      this.connect().catch(err => {
        console.error('Auto-connect error:', err);
      });
    }
  }

  /**
   * Connect to the orchestrator client interface
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to orchestrator at ${this.orchestratorUrl}`);
        
        // Create WebSocket connection using browser's native WebSocket
        this.ws = new WebSocket(this.orchestratorUrl);
        
        // Set up event listeners
        this.ws.onopen = () => {
          console.log('Connected to orchestrator');
          this.connected = true;
          this.emit('connected');
          resolve();
        };
        
        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data) as ClientMessage;
            await this.handleMessage(message);
          } catch (error) {
            console.error('Error handling message:', error);
            this.emit('error', error);
          }
        };
        
        this.ws.onerror = (event) => {
          // WebSocket error events in browsers often don't have useful error information
          // Create a more descriptive error object
          const errorMessage = 'WebSocket connection error';
          console.error('WebSocket error:', event);
          
          // Create a custom error with a useful message
          const customError = {
            message: errorMessage,
            originalEvent: event
          };
          
          this.emit('error', customError);
          reject(customError);
        };
        
        this.ws.onclose = () => {
          console.log('Disconnected from orchestrator');
          this.connected = false;
          this.emit('disconnected');
          
          // Attempt to reconnect if enabled
          if (this.autoReconnect) {
            console.log(`Attempting to reconnect in ${this.reconnectInterval / 1000} seconds...`);
            setTimeout(() => this.connect().catch(err => {
              console.error('Reconnection error:', err);
            }), this.reconnectInterval);
          }
        };
      } catch (error) {
        console.error('Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from the orchestrator
   */
  async handleMessage(message: ClientMessage): Promise<void> {
    console.log(`Client SDK received message: ${JSON.stringify(message)}`);
    
    // Emit the message for custom handlers
    this.emit('message', message);
    
    // Check for pending responses
    if (message.id && this.pendingResponses.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.id)!;
      clearTimeout(timeout);
      this.pendingResponses.delete(message.id);
      
      if (message.type === 'error' || (message.content && message.content.error)) {
        reject(new Error(message.content.error as string || 'Unknown error'));
      } else {
        resolve(message);
      }
      console.log(`Resolved pending response for message ID: ${message.id}`);
      return;
    }
    
    // Handle specific message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.clientId = message.content.clientId as string;
        this.emit('welcome', message.content);
        break;
        
      case 'agent.list':
        this.emit('agent-list', message.content.agents);
        break;
        
      case 'task.result':
        this.emit('task-result', message.content);
        break;
        
      case 'task.status':
        this.emit('task-status', message.content);
        break;
        
      case 'task.created':
        this.emit('task-created', message.content);
        break;
        
      case 'task.notification':
        // Handle task notifications
        console.log(`Received task notification: ${message.content.message} (${message.content.notificationType})`);
        this.emit('task-notification', message.content);
        break;
        
      case 'error':
        console.error(`Received error: ${message.content ? message.content.error : 'Unknown error'}`);
        this.emit('orchestrator-error', message.content || { error: 'Unknown error' });
        break;
        
      default:
        console.log(`Unhandled message type: ${message.type}`);
        break;
    }
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the orchestrator
   */
  async send(message: ClientMessage): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        return reject(new Error('Not connected to orchestrator'));
      }
      
      try {
        // Add message ID if not present
        if (!message.id) {
          message.id = uuidv4();
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message));
          resolve(message.id);
        } else {
          reject(new Error('WebSocket not open, cannot send message'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message and wait for a response
   */
  sendAndWaitForResponse(message: ClientMessage, options: { timeout?: number } = {}): Promise<ClientMessage> {
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    return new Promise((resolve, reject) => {
      this.send(message)
        .then(messageId => {
          if (!messageId) {
            reject(new Error('Failed to send message'));
            return;
          }
          
          // Set timeout
          const timeoutId = setTimeout(() => {
            if (this.pendingResponses.has(messageId)) {
              this.pendingResponses.delete(messageId);
              reject(new Error(`Timeout waiting for response to message ${messageId}`));
            }
          }, timeout);
          
          // Response callback
          this.pendingResponses.set(messageId, {
            resolve: resolve as (value: unknown) => void,
            reject,
            timeout: timeoutId
          });
        })
        .catch(reject);
    });
  }

  /**
   * Send a message to the orchestrator (wrapper for compatibility)
   */
  async sendMessage(message: ClientMessage): Promise<unknown> {
    return this.send(message);
  }
} 