import { EventEmitter } from 'events';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
export declare class MessageHandler extends EventEmitter {
    private webSocketManager;
    private logger;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    private setupListeners;
    /**
     * Handle incoming messages
     * @param {BaseMessage} message The message to handle
     */
    handleMessage(message: BaseMessage): void;
    /**
     * Check if a message is a service task execution request
     * @param message Message to check
     */
    isServiceTaskExecute(message: BaseMessage): boolean;
}
