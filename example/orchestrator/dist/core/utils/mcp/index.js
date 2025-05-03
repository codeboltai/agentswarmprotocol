"use strict";
/**
 * MCP (Model Configuration Protocol) Module Index
 * Exports the MCP functionality for the orchestrator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPAdapter = exports.MCPClient = exports.MCPManager = void 0;
exports.setup = setup;
const mcp_manager_1 = require("./mcp-manager");
Object.defineProperty(exports, "MCPManager", { enumerable: true, get: function () { return mcp_manager_1.MCPManager; } });
const mcp_client_1 = require("./mcp-client");
Object.defineProperty(exports, "MCPClient", { enumerable: true, get: function () { return mcp_client_1.MCPClient; } });
const mcp_adapter_1 = require("./mcp-adapter");
Object.defineProperty(exports, "MCPAdapter", { enumerable: true, get: function () { return mcp_adapter_1.MCPAdapter; } });
/**
 * Set up the MCP components with an event bus
 * @param eventBus - Event emitter for communication
 * @returns MCP interface
 */
function setup(eventBus) {
    return new mcp_adapter_1.MCPAdapter(eventBus);
}
