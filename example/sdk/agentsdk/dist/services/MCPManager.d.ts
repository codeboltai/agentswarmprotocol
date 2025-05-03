import { WebSocketManager } from '../core/WebSocketManager';
export declare class MCPManager {
    private webSocketManager;
    private logger;
    constructor(webSocketManager: WebSocketManager, logger?: Console);
    /**
     * Request MCP service (deprecated)
     * @param params Service parameters
     * @param timeout Request timeout
     * @deprecated Use getMCPServers, getMCPTools, and executeMCPTool instead
     */
    requestMCPService(params?: Record<string, any>, timeout?: number): Promise<any>;
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
    /**
     * Execute a tool by name (will find server automatically)
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param serverId Optional server ID (if known)
     * @param timeout Request timeout
     */
    executeTool(toolName: string, parameters?: Record<string, any>, serverId?: string | null, timeout?: number): Promise<any>;
}
