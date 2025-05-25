/**
 * MCP (Model Configuration Protocol) Module Index
 * Exports the MCP functionality for the orchestrator
 */

import { MCPManager, MCPServer, MCPServerConfig, MCPConnection, MCPTool } from './mcp-manager';
import { MCPClient, MCPServerConfig as ClientServerConfig } from './mcp-client';
import { MCPAdapter, MCPServerFilters } from './mcp-adapter';
import { EventEmitter } from 'events';

/**
 * Set up the MCP components with an event bus
 * @param eventBus - Event emitter for communication
 * @returns MCP interface
 */
export function setup(eventBus: EventEmitter): MCPAdapter {
  return new MCPAdapter(eventBus);
}

export {
  MCPManager,
  MCPClient,
  MCPAdapter,
  MCPServer,
  MCPServerConfig,
  MCPConnection,
  MCPTool,
  ClientServerConfig,
  MCPServerFilters
}; 