import { EventEmitter } from 'events';
import { MCPServer, MCPTool } from '@agentswarmprotocol/types/common';
import { WebSocketClient } from './WebSocketClient';

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
export class MCPManager extends EventEmitter {
  private wsClient: WebSocketClient;

  /**
   * Create a new MCPManager instance
   * @param wsClient - WebSocketClient instance
   */
  constructor(wsClient: WebSocketClient) {
    super();
    this.wsClient = wsClient;
  }

  /**
   * List available MCP servers
   * @param filters - Optional filters
   * @returns List of MCP servers
   */
  async listMCPServers(filters: MCPServerFilters = {}): Promise<MCPServer[]> {
    const response = await this.wsClient.sendRequestWaitForResponse({
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
  async getMCPServerTools(serverId: string): Promise<MCPTool[]> {
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
  async executeMCPTool(serverId: string, toolName: string, parameters: any): Promise<any> {
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

  /**
   * Register event listeners for MCP events
   */
  registerEventListeners(): void {
    this.wsClient.on('mcp-server-list', (servers: MCPServer[]) => {
      console.log('MCP Manager handling mcp-server-list event with servers:', JSON.stringify(servers));
      this.emit('mcp-server-list', servers);
    });
    
    this.wsClient.on('mcp-tool-executed', (result: any) => {
      this.emit('mcp-tool-executed', result);
    });
  }
} 