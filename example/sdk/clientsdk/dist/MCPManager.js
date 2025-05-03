"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPManager = void 0;
const events_1 = require("events");
/**
 * MCPManager - Handles MCP-related operations
 */
class MCPManager extends events_1.EventEmitter {
    /**
     * Create a new MCPManager instance
     * @param sendRequest - Function to send requests
     */
    constructor(sendRequest) {
        super();
        this.sendRequest = sendRequest;
    }
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    async listMCPServers(filters = {}) {
        const response = await this.sendRequest({
            type: 'mcp.server.list',
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
        const response = await this.sendRequest({
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
        const response = await this.sendRequest({
            type: 'mcp.tool.execute',
            content: {
                serverId,
                toolName,
                parameters
            }
        });
        return response.content.result;
    }
    /**
     * Register event listeners for MCP events
     * @param emitter - Event emitter to listen to
     */
    registerEventListeners(emitter) {
        emitter.on('mcp-server-list', (servers) => {
            console.log('MCP Manager handling mcp-server-list event with servers:', JSON.stringify(servers));
            this.emit('mcp-server-list', servers);
        });
        emitter.on('mcp-tool-executed', (result) => {
            this.emit('mcp-tool-executed', result);
        });
    }
}
exports.MCPManager = MCPManager;
//# sourceMappingURL=MCPManager.js.map