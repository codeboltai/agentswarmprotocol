import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';

export class MCPManager {
  constructor(
    private webSocketManager: WebSocketManager,
    private logger: Console = console
  ) {}

  /**
   * Request MCP service (deprecated)
   * @param params Service parameters
   * @param timeout Request timeout
   * @deprecated Use getMCPServers, getMCPTools, and executeMCPTool instead
   */
  async requestMCPService(params: Record<string, any> = {}, timeout = 30000): Promise<any> {
    this.logger.warn('requestMCPService is deprecated. Use getMCPServers, getMCPTools, and executeMCPTool instead.');
    
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'mcp.request',
      content: params
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.result;
  }

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

  /**
   * Execute a tool by name (will find server automatically)
   * @param toolName Tool name
   * @param parameters Tool parameters
   * @param serverId Optional server ID (if known)
   * @param timeout Request timeout
   */
  async executeTool(
    toolName: string, 
    parameters: Record<string, any> = {}, 
    serverId: string | null = null, 
    timeout = 60000
  ): Promise<any> {
    // If server ID is provided, execute directly
    if (serverId) {
      return this.executeMCPTool(serverId, toolName, parameters, timeout);
    }
    
    // Otherwise, find a server that provides this tool
    const servers = await this.getMCPServers();
    
    for (const server of servers) {
      try {
        const tools = await this.getMCPTools(server.id);
        const hasTool = tools.some((tool: any) => tool.name === toolName);
        
        if (hasTool) {
          return this.executeMCPTool(server.id, toolName, parameters, timeout);
        }
      } catch (err) {
        this.logger.warn(`Failed to check tools for server ${server.id}: ${(err as Error).message}`);
      }
    }
    
    throw new Error(`No MCP server found that provides tool: ${toolName}`);
  }
} 