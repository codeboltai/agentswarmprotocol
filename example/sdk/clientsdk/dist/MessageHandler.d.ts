import { EventEmitter } from 'events';
/**
 * MessageHandler - Handles processing of messages from the orchestrator
 */
export declare class MessageHandler extends EventEmitter {
    private pendingResponses;
    /**
     * Create a new MessageHandler instance
     */
    constructor();
    /**
     * Handle incoming messages from the orchestrator
     * @param message - The received message
     */
    handleMessage(message: any): Promise<void>;
    /**
     * Send a message and wait for a response
     * @param message - The message to send
     * @param sendFunc - Function to send the message
     * @param options - Additional options
     * @returns The response message
     */
    waitForResponse(message: any, sendFunc: (message: any) => Promise<string | null>, options?: {
        timeout?: number;
    }): Promise<any>;
    /**
     * Clear all pending responses
     */
    clearPendingResponses(): void;
}
