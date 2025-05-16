import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';

export class MCPManager {
  constructor(
    private webSocketManager: WebSocketManager,
    private logger: Console = console
  ) {}


  /**
   * Get list of MCP servers
   * @param filters Filter criteria
   * @param timeout Request timeout
   */
  async getMCPServers(filters: Record<string, any> = {}, timeout = 30000): Promise<any[]> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'mcp.servers.request',
      content: { filters }
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.servers || [];
  }

  /**
   * Get list of tools for an MCP server
   * @param serverId Server ID
   * @param timeout Request timeout
   */
  async getMCPTools(serverId: string, timeout = 30000): Promise<any[]> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'mcp.tools.request',
      content: { serverId }
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.tools || [];
  }

  /**
   * Execute an MCP tool
   * @param serverId Server ID
   * @param toolName Tool name
   * @param parameters Tool parameters
   * @param timeout Request timeout
   */
  async executeMCPTool(
    serverId: string, 
    toolName: string, 
    parameters: Record<string, any> = {},
    timeout = 60000
  ): Promise<any> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'mcp.tool.execute',
      content: {
        serverId,
        tool: toolName,
        parameters
      }
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.result;
  }

} 