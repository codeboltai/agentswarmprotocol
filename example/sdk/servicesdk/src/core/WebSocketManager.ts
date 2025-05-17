import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private connecting: boolean = false;

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
    if (this.connected || this.connecting) {
      return Promise.resolve(this);
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.orchestratorUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.connecting = false;
          this.emit('connected');
          resolve(this);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as BaseMessage;
            this.emit('message', message);
          } catch (err) {
            const error = err as Error;
            this.emit('error', new Error(`Failed to parse message: ${error.message}`));
          }
        });

        this.ws.on('error', (error) => {
          this.emit('error', error);
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.connecting = false;
          this.emit('disconnected');
          
          if (this.autoReconnect) {
            setTimeout(() => {
              this.connect().catch(err => {
                this.emit('error', new Error(`Reconnection failed: ${err.message}`));
              });
            }, this.reconnectInterval);
          }
        });
      } catch (err) {
        this.connecting = false;
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
   * Check if connected to the orchestrator
   */
  isConnected(): boolean {
    return this.connected;
  }

 
} 