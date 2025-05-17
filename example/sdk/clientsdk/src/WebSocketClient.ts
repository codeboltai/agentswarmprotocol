// For Node.js environments
// Using dynamic imports for better cross-environment compatibility
import { EventEmitter } from 'events';
import type * as WebSocketTypes from 'ws';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration options for WebSocketClient
 */
export interface WebSocketClientConfig {
  /** WebSocket URL of the orchestrator client interface */
  orchestratorUrl?: string;
  /** Whether to automatically reconnect on disconnection */
  autoReconnect?: boolean;
  /** Interval in ms to attempt reconnection */
  reconnectInterval?: number;
  /** Force the use of browser WebSocket implementation */
  forceBrowserWebSocket?: boolean;
  /** Default timeout for requests in milliseconds */
  defaultTimeout?: number;
}

/**
 * Pending response entry type
 */
interface PendingResponse {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Determine if code is running in a browser environment
 */
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
};

/**
 * Create a WebSocket instance based on the current environment
 * @param url WebSocket URL to connect to
 */
async function createWebSocketInstance(url: string): Promise<WebSocketTypes.WebSocket | WebSocket> {
  if (isBrowser()) {
    return new window.WebSocket(url);
  } else {
    try {
      // Dynamically import the 'ws' package for Node.js environment
      const WebSocketModule = await import('ws');
      return new WebSocketModule.default(url);
    } catch (error) {
      throw new Error('Failed to load WebSocket module for Node.js: ' + error);
    }
  }
}

/**
 * WebSocketClient - Handles WebSocket connection to the orchestrator
 * Works in both browser and Node.js environments
 */
export class WebSocketClient extends EventEmitter {
  private orchestratorUrl: string;
  private autoReconnect: boolean;
  private reconnectInterval: number;
  private connected: boolean;
  private clientId: string | null;
  private ws: WebSocketTypes.WebSocket | WebSocket | null;
  private forceBrowserWebSocket: boolean;
  private isNodeEnvironment: boolean;
  private defaultTimeout: number;
  private pendingResponses: Map<string, PendingResponse>;

  /**
   * Create a new WebSocketClient instance
   * @param config - Configuration options
   */
  constructor(config: WebSocketClientConfig = {}) {
    super();
    
    this.isNodeEnvironment = !isBrowser();
    
    const defaultUrl = this.isNodeEnvironment
      ? (process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001')
      : ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host);
    
    this.orchestratorUrl = config.orchestratorUrl || defaultUrl;
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.defaultTimeout = config.defaultTimeout || 30000;
    this.connected = false;
    this.clientId = null;
    this.ws = null;
    this.forceBrowserWebSocket = config.forceBrowserWebSocket || false;
    this.pendingResponses = new Map();
    
    // Set up message handling for responses
    this.on('message', this.handleMessage.bind(this));
  }

  /**
   * Connect to the orchestrator client interface
   * @returns Promise that resolves when connected
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        console.log(`Connecting to orchestrator at ${this.orchestratorUrl}`);
        
        // Determine if we should use the browser's WebSocket implementation
        const shouldUseBrowserWs = this.forceBrowserWebSocket || isBrowser();
        
        this.ws = await createWebSocketInstance(this.orchestratorUrl);
        
        if (shouldUseBrowserWs) {
          // Browser WebSocket implementation
          const browserWs = this.ws as WebSocket;
          
          // Set up browser event listeners
          browserWs.onopen = () => {
            console.log('Connected to orchestrator');
            this.connected = true;
            this.emit('connected');
            resolve();
          };
          
          browserWs.onmessage = async (event) => {
            try {
              const message = JSON.parse(event.data as string);
              this.emit('message', message);
            } catch (error) {
              console.error('Error handling message:', error);
              this.emit('error', error);
            }
          };
          
          browserWs.onerror = (event) => {
            const errorMessage = 'WebSocket connection error';
            console.error('WebSocket error:', event);
            
            const customError = {
              message: errorMessage,
              originalEvent: event
            };
            
            this.emit('error', customError);
            reject(customError);
          };
          
          browserWs.onclose = () => {
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
        } else {
          // Node.js WebSocket implementation
          const nodeWs = this.ws as WebSocketTypes.WebSocket;
          
          // Set up Node.js event listeners
          nodeWs.on('open', () => {
            console.log('Connected to orchestrator');
            this.connected = true;
            this.emit('connected');
            resolve();
          });
          
          nodeWs.on('message', async (data: WebSocketTypes.Data) => {
            try {
              const message = JSON.parse(data.toString());
              this.emit('message', message);
            } catch (error) {
              console.error('Error handling message:', error);
              this.emit('error', error);
            }
          });
          
          nodeWs.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
            reject(error);
          });
          
          nodeWs.on('close', () => {
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
          });
        }
      } catch (error) {
        console.error('Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Send a message to the orchestrator
   * @param message - The message to send
   * @returns The message ID or null if not sent
   */
  async send(message: any): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        return reject(new Error('Not connected to orchestrator'));
      }
      
      try {
        const messageStr = JSON.stringify(message);
        
        if (this.ws) {
          if (isBrowser() || this.forceBrowserWebSocket) {
            // Browser WebSocket implementation
            const wsReadyState = (this.ws as WebSocket).readyState;
            
            if (wsReadyState === 1) { // WebSocket.OPEN
              (this.ws as WebSocket).send(messageStr);
              resolve(message.id);
            } else {
              reject(new Error('WebSocket not open, cannot send message'));
            }
          } else {
            // Node.js WebSocket implementation
            const nodeWs = this.ws as WebSocketTypes.WebSocket;
            
            if (nodeWs.readyState === 1) { // WebSocket.OPEN
              nodeWs.send(messageStr, (err?: Error) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(message.id);
                }
              });
            } else {
              reject(new Error('WebSocket not open, cannot send message'));
            }
          }
        } else {
          reject(new Error('WebSocket not initialized, cannot send message'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): void {
    if (this.ws) {
      this.autoReconnect = false; // Disable reconnection
      
      if (isBrowser() || this.forceBrowserWebSocket) {
        (this.ws as WebSocket).close();
      } else {
        (this.ws as WebSocketTypes.WebSocket).close();
      }
      
      this.ws = null;
      console.log('Disconnected from orchestrator');
    }
  }

  /**
   * Get the connection status
   * @returns Whether the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the client ID
   * @returns The client ID or null if not connected
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Set the client ID
   * @param clientId - The client ID
   */
  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  /**
   * Handle incoming messages from the orchestrator
   * @param message - The received message
   */
  private async handleMessage(message: any): Promise<void> {
    // Check for pending responses
    if (message.id && this.pendingResponses.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingResponses.get(message.id)!;
      clearTimeout(timeout);
      this.pendingResponses.delete(message.id);
      
      if (message.type === 'error' || (message.content && message.content.error)) {
        reject(new Error(message.content ? message.content.error : 'Unknown error'));
      } else {
        console.log(`Resolved pending response for message ID: ${message.id}`);
        resolve(message);
      }
      return;
    }
    
    // Emit specific message types for components to listen to
    switch (message.type) {
      case 'orchestrator.welcome':
        if (message.content && message.content.clientId) {
          this.clientId = message.content.clientId;
        }
        this.emit('welcome', message.content);
        break;
        
      case 'agent.list':
        this.emit('agent-list', message.content.agents);
        break;
        
      case 'mcp.server.list':
        this.emit('mcp-server-list', message.content.servers);
        break;
        
      case 'task.result':
        this.emit('task-result', message.content);
        // Also emit task.update for backward compatibility with UI
        this.emit('task.update', message.content);
        break;
        
      case 'task.status':
        this.emit('task-status', message.content);
        // Also emit task.update for backward compatibility with UI
        this.emit('task.update', message.content);
        break;
        
      case 'task.created':
        this.emit('task-created', message.content);
        break;
        
      case 'task.notification':
        this.emit('task-notification', message.content);
        break;
        
      case 'error':
        this.emit('orchestrator-error', message.content || { error: 'Unknown error' });
        break;
    }
  }

  /**
   * Send a request message and wait for a response
   * @param message - The message to send
   * @param options - Additional options
   * @returns The response message
   */
  async sendRequest(message: any, options: { timeout?: number } = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to orchestrator');
    }
    
    // Set message ID if not set
    if (!message.id) {
      message.id = uuidv4();
    }
    
    // Set timestamp if not set
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    const timeout = options.timeout || this.defaultTimeout;
    const messageId = message.id;
    
    return new Promise((resolve, reject) => {
      this.send(message)
        .then(() => {
          // Set timeout
          const timeoutId = setTimeout(() => {
            if (this.pendingResponses.has(messageId)) {
              this.pendingResponses.delete(messageId);
              reject(new Error(`Timeout waiting for response to message ${messageId}`));
            }
          }, timeout);
          
          // Store pending response
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