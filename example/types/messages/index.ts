/**
 * Agent Swarm Protocol - Message Type Exports
 * 
 * This file exports all message type definitions for easy importing
 */

// Export message types as namespaces to avoid naming conflicts
import * as AgentMessages from './agent-messages';
import * as ServiceMessages from './service-messages';
import * as ClientMessages from './client-messages';

export {
  AgentMessages,
  ServiceMessages,
  ClientMessages
}; 