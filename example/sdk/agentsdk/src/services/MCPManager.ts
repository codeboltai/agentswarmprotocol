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
    try {
      this.logger.debug(`Getting MCP servers list with filters:`, filters);
      
      const response = await this.webSocketManager.sendRequestWaitForResponse({
        id: uuidv4(),
        type: 'agent.mcp.servers.list',
        content: { filters }
      } , {
        customEvent: 'agent.mcp.servers.list.result'
      });
      
      if (response.content && response.content.error) {
        throw new Error(response.content.error);
      }
      
      return response.content.servers || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get MCP servers list: ${errorMessage}`);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  /**
   * Get list of tools for an MCP server
   * @param serverId Server ID
   * @param timeout Request timeout
   */
  async getMCPTools(serverId: string, timeout = 30000): Promise<any[]> {
    try {
      this.logger.debug(`Getting tools list for MCP server: ${serverId}`);
      
      if (!serverId) {
        throw new Error('Server ID is required to list MCP tools');
      }
      
      const response = await this.webSocketManager.sendAndWaitForResponse({
        id: uuidv4(),
        type: 'mcp.tools.list',
        content: { serverId }
      } as BaseMessage, timeout);
      
      if (response.content && response.content.error) {
        throw new Error(response.content.error);
      }
      
      return response.content.tools || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get MCP tools for server ${serverId}: ${errorMessage}`);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
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
    try {
      this.logger.debug(`Executing MCP tool "${toolName}" on server "${serverId}" with parameters:`, parameters);
      
      if (!serverId) {
        throw new Error('Server ID is required to execute an MCP tool');
      }
      
      if (!toolName) {
        throw new Error('Tool name is required to execute an MCP tool');
      }
      
      const response = await this.webSocketManager.sendAndWaitForResponse({
        id: uuidv4(),
        type: 'mcp.tool.execute',
        content: {
          serverId,
          toolName,
          parameters
        }
      } as BaseMessage, timeout);
      
      if (response.content && response.content.error) {
        throw new Error(response.content.error);
      }
      
      // Handle response format which might come in content.result
      if (response.content && response.content.result !== undefined) {
        return response.content.result;
      }
      
      // In case the result is directly in the content
      return response.content;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to execute MCP tool "${toolName}" on server "${serverId}": ${errorMessage}`);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }
} 