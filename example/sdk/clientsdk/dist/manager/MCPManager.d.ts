import { MCPServer, MCPTool } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from '../service/WebSocketClient';
/**
 * MCP server filter options
 */
export interface MCPServerFilters {
    /** Filter by server type */
    type?: string;
    /** Filter by server status */
    status?: string;
    /** Filter by server capabilities */
    capabilities?: string[];
}
/**
 * MCPManager - Handles MCP-related operations
 */
export declare class MCPManager {
    private wsClient;
    /**
     * Create a new MCPManager instance
     * @param wsClient - WebSocketClient instance
     */
    constructor(wsClient: WebSocketClient);
    /**
     * List available MCP servers
     * @param filters - Optional filters
     * @returns List of MCP servers
     */
    listMCPServers(filters?: MCPServerFilters): Promise<MCPServer[]>;
    /**
     * Get tools available on an MCP server
     * @param serverId - ID of the server to get tools for
     * @returns List of tools
     */
    getMCPServerTools(serverId: string): Promise<MCPTool[]>;
    /**
     * Execute a tool on an MCP server
     * @param serverId - ID of the server to execute the tool on
     * @param toolName - Name of the tool to execute
     * @param parameters - Tool parameters
     * @returns Tool execution result
     */
    executeMCPTool(serverId: string, toolName: string, parameters: any): Promise<any>;
}
