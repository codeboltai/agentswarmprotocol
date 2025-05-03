// For Node.js environments
// Using dynamic imports for better cross-environment compatibility
import { EventEmitter } from 'events';
import type * as WebSocketTypes from 'ws';

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
    this.connected = false;
    this.clientId = null;
    this.ws = null;
    this.forceBrowserWebSocket = config.forceBrowserWebSocket || false;
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
} 