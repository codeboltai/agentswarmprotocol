import { WebSocketManager } from '../core/WebSocketManager';
export declare class MCPManager {
    private webSocketManager;
    private logger;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    /**
     * Get list of MCP servers
     * @param filters Filter criteria
     * @param timeout Request timeout
     */
    getMCPServers(filters?: Record<string, any>, timeout?: number): Promise<any[]>;
    /**
     * Get list of tools for an MCP server
     * @param serverId Server ID
     * @param timeout Request timeout
     */
    getMCPTools(serverId: string, timeout?: number): Promise<any[]>;
    /**
     * Execute an MCP tool
     * @param serverId Server ID
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param timeout Request timeout
     */
    executeMCPTool(serverId: string, toolName: string, parameters?: Record<string, any>, timeout?: number): Promise<any>;
}
