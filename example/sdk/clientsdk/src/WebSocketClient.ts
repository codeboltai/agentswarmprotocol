import WebSocket from 'ws';
import { EventEmitter } from 'events';

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
}

/**
 * WebSocketClient - Handles WebSocket connection to the orchestrator
 */
export class WebSocketClient extends EventEmitter {
  private orchestratorUrl: string;
  private autoReconnect: boolean;
  private reconnectInterval: number;
  private connected: boolean;
  private clientId: string | null;
  private ws: WebSocket | null;

  /**
   * Create a new WebSocketClient instance
   * @param config - Configuration options
   */
  constructor(config: WebSocketClientConfig = {}) {
    super();
    
    this.orchestratorUrl = config.orchestratorUrl || process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.connected = false;
    this.clientId = null;
    this.ws = null;
  }

  /**
   * Connect to the orchestrator client interface
   * @returns Promise that resolves when connected
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      try {
        console.log(`Connecting to orchestrator at ${this.orchestratorUrl}`);
        
        // Create WebSocket connection
        this.ws = new WebSocket(this.orchestratorUrl);
        
        // Set up event listeners
        this.ws.on('open', () => {
          console.log('Connected to orchestrator');
          this.connected = true;
          this.emit('connected');
          resolve();
        });
        
        this.ws.on('message', async (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.emit('message', message);
          } catch (error) {
            console.error('Error handling message:', error);
            this.emit('error', error);
          }
        });
        
        this.ws.on('error', (error: Error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });
        
        this.ws.on('close', () => {
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
      if (!this.connected) {
        return reject(new Error('Not connected to orchestrator'));
      }
      
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message), (err?: Error) => {
            if (err) {
              reject(err);
            } else {
              resolve(message.id);
            }
          });
        } else {
          reject(new Error('WebSocket not open, cannot send message'));
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
      this.ws.close();
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