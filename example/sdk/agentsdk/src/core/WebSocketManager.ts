import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { PendingResponse } from './types';

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private connecting: boolean = false;
  private pendingResponses: Map<string, PendingResponse> = new Map();

  constructor(
    private orchestratorUrl: string,
    private autoReconnect: boolean = true,
    private reconnectInterval: number = 5000,
    private logger: Console = console
  ) {
    super();
  }

  /**
   * Connect to the orchestrator
   * @returns {Promise} Resolves when connected
   */
  connect(): Promise<WebSocketManager> {
    if (this.connected) {
      this.logger.debug('Already connected to orchestrator');
      return Promise.resolve(this);
    }
    
    if (this.connecting) {
      this.logger.debug('Already connecting to orchestrator');
      return Promise.resolve(this);
    }

    this.connecting = true;
    this.logger.info(`Connecting to orchestrator at ${this.orchestratorUrl}`);

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection with appropriate error handling
        this.ws = new WebSocket(this.orchestratorUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.connecting = false;
          this.logger.info('Connected to orchestrator successfully');
          this.emit('connected');
          resolve(this);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as BaseMessage;
            
            // Check if this is a response to a pending request
            if (message.requestId && this.pendingResponses.has(message.requestId)) {
              const pendingResponse = this.pendingResponses.get(message.requestId);
              if (pendingResponse) {
                clearTimeout(pendingResponse.timer);
                this.pendingResponses.delete(message.requestId);
                pendingResponse.resolve(message);
                return;
              }
            }
            
            this.emit('message', message);
          } catch (err) {
            const error = err as Error;
            this.logger.error(`Failed to parse message: ${error.message}`);
            this.emit('error', new Error(`Failed to parse message: ${error.message}`));
          }
        });

        this.ws.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`WebSocket error: ${errorMessage}`);
          this.emit('error', error);
          
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          this.connected = false;
          this.connecting = false;
          this.logger.info(`Disconnected from orchestrator. Code: ${code}, Reason: ${reason}`);
          this.emit('disconnected');
          
          // Reject any pending responses with connection closed error
          for (const [id, pendingResponse] of this.pendingResponses.entries()) {
            clearTimeout(pendingResponse.timer);
            pendingResponse.reject(new Error('Connection closed'));
            this.pendingResponses.delete(id);
          }
          
          if (this.autoReconnect) {
            this.logger.info(`Will attempt to reconnect in ${this.reconnectInterval}ms`);
            setTimeout(() => {
              this.connect().catch(err => {
                const reconnectError = err instanceof Error ? err.message : String(err);
                this.logger.error(`Reconnection failed: ${reconnectError}`);
                this.emit('error', new Error(`Reconnection failed: ${reconnectError}`));
              });
            }, this.reconnectInterval);
          }
        });
      } catch (err) {
        this.connecting = false;
        const connectionError = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to create WebSocket connection: ${connectionError}`);
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the orchestrator
   */
  disconnect(): WebSocketManager {
    if (this.ws) {
      this.autoReconnect = false;
      this.ws.close();
    }
    return this;
  }

  /**
   * Send a message to the orchestrator
   * @param message Message to send
   */
  send(message: BaseMessage): Promise<BaseMessage> {
    if (!this.ws || !this.connected) {
      return Promise.reject(new Error('Not connected to orchestrator'));
    }

    return new Promise((resolve, reject) => {
      try {
        const messageString = JSON.stringify(message);
        this.ws!.send(messageString, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(message);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message and wait for a response
   * @param message Message to send
   * @param timeout Timeout in milliseconds
   */
  sendAndWaitForResponse(message: BaseMessage, timeout = 30000): Promise<BaseMessage> {
    return new Promise((resolve, reject) => {
      // Check if connected first
      if (!this.connected) {
        return reject(new Error('Not connected to orchestrator. Please ensure connection is established before sending messages.'));
      }
      
      // Validate message has an ID
      if (!message.id) {
        return reject(new Error('Message must have an ID to wait for response'));
      }
      
      // Set up timeout
      const timer = setTimeout(() => {
        if (this.pendingResponses.has(message.id)) {
          this.pendingResponses.delete(message.id);
          this.logger.warn(`Request ${message.id} (${message.type}) timed out after ${timeout}ms`);
          reject(new Error(`Request timed out after ${timeout}ms. Type: ${message.type}`));
        }
      }, timeout);

      // Store the pending response handlers
      this.pendingResponses.set(message.id, { resolve, reject, timer });

      // Send the message
      this.send(message).catch(error => {
        clearTimeout(timer);
        this.pendingResponses.delete(message.id);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send message ${message.id} (${message.type}): ${errorMessage}`);
        
        reject(error instanceof Error 
          ? error 
          : new Error(`Failed to send message: ${errorMessage}`));
      });
    });
  }

  /**
   * Check if connected to the orchestrator
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the map of pending responses
   */
  getPendingResponses(): Map<string, PendingResponse> {
    return this.pendingResponses;
  }

  /**
   * Handle response for a pending request
   */
  handleResponse(requestId: string, message: BaseMessage, isError: boolean = false): boolean {
    if (this.pendingResponses.has(requestId)) {
      const { resolve, reject, timer } = this.pendingResponses.get(requestId)!;
      clearTimeout(timer);
      this.pendingResponses.delete(requestId);
      
      if (isError) {
        reject(new Error(message.content ? message.content.error : 'Unknown error'));
      } else {
        resolve(message);
      }
      return true;
    }
    return false;
  }
} 