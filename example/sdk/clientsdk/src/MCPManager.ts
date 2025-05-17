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
export class MCPManager extends EventEmitter {
  private sendRequest: (message: any) => Promise<any>;

  /**
   * Create a new MCPManager instance
   * @param sendRequest - Function to send requests
   */
  constructor(sendRequest: (message: any) => Promise<any>) {
    super();
    this.sendRequest = sendRequest;
  }

  /**
   * List available MCP servers
   * @param filters - Optional filters
   * @returns List of MCP servers
   */
  async listMCPServers(filters: MCPServerFilters = {}): Promise<MCPServer[]> {
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
  async getMCPServerTools(serverId: string): Promise<MCPTool[]> {
    const response = await this.sendRequest({
      type: 'mcp.server.tools',
      content: {
        serverId
      }
    });
    
    return response.content.tools;
  }



  /**
   * Register event listeners for MCP events
   * @param emitter - Event emitter to listen to
   */
  registerEventListeners(emitter: EventEmitter): void {
    emitter.on('mcp-server-list', (servers: MCPServer[]) => {
      console.log('MCP Manager handling mcp-server-list event with servers:', JSON.stringify(servers));
      this.emit('mcp-server-list', servers);
    });
    
    emitter.on('mcp-tool-executed', (result: any) => {
      this.emit('mcp-tool-executed', result);
    });
  }
} 