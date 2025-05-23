"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPManager = void 0;
/**
 * MCPManager - Handles MCP-related operations
 */
class MCPManager {
    /**
     * Create a new MCPManager instance
     * @param wsClient - WebSocketClient instance
     */
    constructor(wsClient) {
        this.wsClient = wsClient;
    }
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    async listMCPServers(filters = {}) {
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'client.mcp.server.list.request',
            content: { filters }
        });
        return response.content.servers;
    }
    /**
     * Get tools available on an MCP server
     * @param serverId - ID of the server to get tools for
     * @returns List of tools
     */
    async getMCPServerTools(serverId) {
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'mcp.server.tools',
            content: {
                serverId
            }
        });
        return response.content.tools;
    }
    /**
     * Execute a tool on an MCP server
     * @param serverId - ID of the server to execute the tool on
     * @param toolName - Name of the tool to execute
     * @param parameters - Tool parameters
     * @returns Tool execution result
     */
    async executeMCPTool(serverId, toolName, parameters) {
        const response = await this.wsClient.sendRequestWaitForResponse({
            type: 'mcp.tool.execute',
            content: {
                serverId,
                toolName,
                parameters
            }
        });
        return response.content.result;
    }
}
exports.MCPManager = MCPManager;
//# sourceMappingURL=MCPManager.js.map