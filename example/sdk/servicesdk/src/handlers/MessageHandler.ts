import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskExecuteMessage } from '../core/types';

export class MessageHandler extends EventEmitter {
  constructor(
    private webSocketManager: WebSocketManager,
    private logger: Console = console
  ) {
    super();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.webSocketManager.on('message', (message: BaseMessage) => {
      this.handleMessage(message);
    });
  }

  /**
   * Handle incoming messages
   * @param {BaseMessage} message The message to handle
   */
  handleMessage(message: BaseMessage): void {
    this.emit('message', message);
    
    // Check if this is a response to a pending request
    if (message.requestId && this.webSocketManager.getPendingResponses().has(message.requestId)) {
      const isError = message.type === 'error' || (message.content && message.content.error);
      this.webSocketManager.handleResponse(message.requestId, message, isError);
      return;
    }

    // Emit for the specific message type
    this.emit(message.type, message.content, message);
    
    // For standard message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
        
      case 'service.registered':
        this.emit('registered', message.content);
        break;
        
      case 'notification.received':
        this.emit('notification-received', message.content);
        break;
        
      case 'ping':
        this.webSocketManager.send({ type: 'pong', id: message.id, content: {} } as BaseMessage);
        break;
        
      case 'error':
        this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
        break;
    }
  }

  /**
   * Check if a message is a service task execution request
   * @param message Message to check
   */
  isServiceTaskExecute(message: BaseMessage): boolean {
    return message.type === 'service.task.execute';
  }
} 