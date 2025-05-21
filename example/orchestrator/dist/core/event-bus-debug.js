"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugEventEmitter = void 0;
exports.wrapEventBus = wrapEventBus;
const events_1 = require("events");
/**
 * DebugEventEmitter - A wrapper around EventEmitter that adds logging for debugging
 */
class DebugEventEmitter extends events_1.EventEmitter {
    constructor() {
        super();
        this.originalEmit = events_1.EventEmitter.prototype.emit;
        // Override the emit method to add logging
        this.emit = function (event, ...args) {
            console.log(`[DEBUG] Event emitted: ${String(event)} with ${args.length} arguments`);
            // Check for listener count mismatch
            const listeners = this.listeners(event);
            if (listeners.length > 0) {
                // Check each listener to ensure it has the correct parameter count
                listeners.forEach((listener, index) => {
                    const expectedParams = listener.length;
                    console.log(`[DEBUG] Listener ${index} expects ${expectedParams} parameters, got ${args.length}`);
                    if (expectedParams > 0 && args.length !== expectedParams) {
                        console.warn(`[WARNING] Parameter count mismatch for event '${String(event)}': ` +
                            `listener expects ${expectedParams}, but ${args.length} were provided`);
                    }
                });
            }
            // Call the original emit method
            return this.originalEmit.apply(this, [event, ...args]);
        };
    }
}
exports.DebugEventEmitter = DebugEventEmitter;
function wrapEventBus(eventBus) {
    const debugEventBus = new DebugEventEmitter();
    // Copy all existing listeners to the debug event bus
    for (const event of eventBus.eventNames()) {
        const listeners = eventBus.listeners(event);
        for (const listener of listeners) {
            debugEventBus.on(event, listener);
        }
    }
    // Return the wrapped event bus
    return debugEventBus;
}
