const { MCPManager } = require('./mcp-manager');
const { MCPClient } = require('./mcp-client');
const { MCPAdapter } = require('./mcp-adapter');

/**
 * MCP Integration module
 * Provides functionality to integrate Model Context Protocol servers with the ASP Orchestrator
 */
module.exports = {
  MCPManager,
  MCPClient,
  MCPAdapter,
  
  /**
   * Initialize and set up MCP support for the orchestrator
   * @param {EventEmitter} eventBus - Orchestrator's event bus
   * @returns {MCPAdapter} The configured MCP adapter
   */
  setup(eventBus) {
    return new MCPAdapter(eventBus);
  }
}; 