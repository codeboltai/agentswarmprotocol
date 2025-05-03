import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pending response entry type
 */
interface PendingResponse {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

/**
 * MessageHandler - Handles processing of messages from the orchestrator
 */
export class MessageHandler extends EventEmitter {
  private pendingResponses: Map<string, PendingResponse>;

  /**
   * Create a new MessageHandler instance
   */
  constructor() {
    super();
    this.pendingResponses = new Map();
  }

  /**
   * Handle incoming messages from the orchestrator
   * @param message - The received message
   */
  async handleMessage(message: any): Promise<void> {
    console.log(`Client SDK received message: ${JSON.stringify(message)}`);
    
    // Emit the message for custom handlers
    this.emit('message', message);
    
    // Check for pending responses
    if (message.id && this.pendingResponses.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.id)!;
      clearTimeout(timeout);
      this.pendingResponses.delete(message.id);
      
      if (message.type === 'error' || (message.content && message.content.error)) {
        reject(new Error(message.content ? message.content.error : 'Unknown error'));
      } else {
        resolve(message);
      }
      console.log(`Resolved pending response for message ID: ${message.id}`);
      return;
    }
    
    // Handle specific message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
        
      case 'agent.list':
        this.emit('agent-list', message.content.agents);
        break;
        
      case 'mcp.server.list':
        console.log('Emitting mcp-server-list event with servers:', JSON.stringify(message.content.servers));
        this.emit('mcp-server-list', message.content.servers);
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
   * Send a message and wait for a response
   * @param message - The message to send
   * @param sendFunc - Function to send the message
   * @param options - Additional options
   * @returns The response message
   */
  waitForResponse(message: any, sendFunc: (message: any) => Promise<string | null>, options: { timeout?: number } = {}): Promise<any> {
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    // Add message ID if not present
    if (!message.id) {
      message.id = uuidv4();
    }
    
    return new Promise((resolve, reject) => {
      sendFunc(message)
        .then(messageId => {
          if (!messageId) {
            return reject(new Error('Failed to send message'));
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
            resolve,
            reject,
            timeout: timeoutId
          });
        })
        .catch(reject);
    });
  }

  /**
   * Clear all pending responses
   */
  clearPendingResponses(): void {
    for (const [_, { timeout }] of this.pendingResponses.entries()) {
      clearTimeout(timeout);
    }
    this.pendingResponses.clear();
  }
} 