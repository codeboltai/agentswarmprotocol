import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { MessageHandler as MessageHandlerType } from '../core/types';
import { WebSocketManager } from '../core/WebSocketManager';

export class InternalMessageHandler extends EventEmitter {
  private messageHandlers: Map<string, MessageHandlerType> = new Map();

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
    
    // Check if there's a specific handler registered for this message type
    if (this.messageHandlers.has(message.type)) {
      try {
        this.messageHandlers.get(message.type)!(message.content, message);
      } catch (err) {
        const error = err as Error;
        this.logger.error(`Error in message handler for ${message.type}: ${error.message}`);
        this.emit('error', error);
      }
    }

    // For standard message types
    switch (message.type) {
      case 'orchestrator.welcome':
        this.emit('welcome', message.content);
        break;
        
      case 'agent.request.accepted':
        this.emit('agent-request-accepted', message.content);
        break;
        
      case 'agent.response':
        this.emit('agent-response', message.content);
        break;
        
      case 'agent.registered':
        this.emit('registered', message.content);
        break;
        
      case 'service.response':
        this.emit('service-response', message.content);
        break;
        
      case 'ping':
        this.webSocketManager.send({ type: 'pong', id: message.id, content: {} } as BaseMessage);
        break;
        
      case 'error':
        this.emit('error', new Error(message.content ? message.content.error : 'Unknown error'));
        break;
        
      // MCP message types
      case 'mcp.servers.list':
        this.emit('mcp-servers-list', message.content);
        break;
        
      case 'mcp.tools.list':
        this.emit('mcp-tools-list', message.content);
        break;
        
      case 'mcp.tool.execution.result':
        this.emit('mcp-tool-execution-result', message.content);
        break;
    }
  }

  /**
   * Register a message handler for a specific message type
   * @param messageType Type of message to handle
   * @param handler Handler function
   */
  onMessage(messageType: string, handler: MessageHandlerType): this {
    this.messageHandlers.set(messageType, handler);
    return this;
  }
} 