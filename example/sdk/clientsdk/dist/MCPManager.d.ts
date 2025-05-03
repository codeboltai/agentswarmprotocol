import { EventEmitter } from 'events';
import { MCPServer, MCPTool } from '@agentswarmprotocol/types/common';
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
export declare class MCPManager extends EventEmitter {
    private sendRequest;
    /**
     * Create a new MCPManager instance
     * @param sendRequest - Function to send requests
     */
    constructor(sendRequest: (message: any) => Promise<any>);
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
    /**
     * Register event listeners for MCP events
     * @param emitter - Event emitter to listen to
     */
    registerEventListeners(emitter: EventEmitter): void;
}
