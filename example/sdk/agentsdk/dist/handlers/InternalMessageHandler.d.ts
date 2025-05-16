import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { MessageHandler as MessageHandlerType } from '../core/types';
import { WebSocketManager } from '../core/WebSocketManager';
export declare class InternalMessageHandler extends EventEmitter {
    private webSocketManager;
    private logger;
    private messageHandlers;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    private setupListeners;
    /**
     * Handle incoming messages
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message: BaseMessage): void;
    /**
     * Register a message handler for a specific message type
     * @param messageType Type of message to handle
     * @param handler Handler function
     */
    onMessage(messageType: string, handler: MessageHandlerType): this;
}
