import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for MCP server configuration
 */
interface MCPServerConfig {
  name: string;
  path?: string;
  command?: string;
  args?: string[];
  type: string;
}

/**
 * Interface for MCP tool
 */
interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/**
 * MCPClient - Client implementation for Model Context Protocol using official SDK
 * Handles communication with MCP servers using the official TypeScript SDK
 */
class MCPClient {
  private config: MCPServerConfig;
  private client: Client | null;
  private transport: StdioClientTransport | null;
  private tools: MCPTool[];
  private initialized: boolean;
  readonly connectionId: string;

  constructor(serverConfig: MCPServerConfig) {
    this.config = serverConfig;
    this.client = null;
    this.transport = null;
    this.tools = [];
    this.initialized = false;
    this.connectionId = uuidv4();
  }

  /**
   * Connect to the MCP server
   * @returns {Promise<Array>} List of available tools
   */
  async connect(): Promise<MCPTool[]> {
    if (this.client) {
      console.log('MCP client already connected, disconnecting first');
      await this.disconnect();
    }

    try {
      // Determine command based on server configuration
      let command: string;
      let args: string[];
      
      if (this.config.command && this.config.args) {
        // Use explicit command and args from configuration
        command = this.config.command;
        args = this.config.args;
        console.log(`Starting MCP server with command: ${command} ${args.join(' ')}`);
      } else if (this.config.path) {
        // Use path-based configuration with type detection
        switch (this.config.type.toLowerCase()) {
          case 'python':
            command = 'python';
            args = [this.config.path];
            break;
          case 'node':
            command = 'node';
            args = [this.config.path];
            break;
          default:
            throw new Error(`Unsupported server type: ${this.config.type}`);
        }
        console.log(`Starting MCP server with path: ${command} ${args.join(' ')}`);
      } else {
        throw new Error('Either command+args or path must be provided for MCP server');
      }
      
      // Create transport using official SDK
      this.transport = new StdioClientTransport({
        command,
        args
      });

      // Create client using official SDK
      this.client = new Client(
        {
          name: 'orchestrator-mcp-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Connect to the server
      await this.client.connect(this.transport);
      
      this.initialized = true;
      
      // List available tools
      this.tools = await this.listTools();
      
      return this.tools;
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  /**
   * List available tools from the MCP server
   * @returns {Promise<MCPTool[]>} List of available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.initialized) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client.listTools();
      
      return response.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {}
      }));
    } catch (error) {
      console.error('Failed to list MCP tools:', error);
      throw error;
    }
  }

  /**
   * Call a tool on the MCP server
   * @param {string} toolName - Name of the tool to call
   * @param {Record<string, any>} toolArgs - Arguments for the tool
   * @returns {Promise<Object>} Tool execution result
   */
  async callTool(toolName: string, toolArgs: Record<string, any>): Promise<{ result: any, metadata: Record<string, any> }> {
    if (!this.client || !this.initialized) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: toolArgs
      });
      
      return {
        result: response.content || response,
        metadata: response.metadata || {}
      };
    } catch (error) {
      console.error(`Failed to call MCP tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a tool on the MCP server (alias for callTool)
   * @param {string} toolName - Name of the tool to execute
   * @param {Record<string, any>} toolArgs - Arguments for the tool
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(toolName: string, toolArgs: Record<string, any>): Promise<any> {
    const result = await this.callTool(toolName, toolArgs);
    return result.result;
  }

  /**
   * Get the list of available tools
   * @returns {MCPTool[]} List of available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      console.log('MCP client already disconnected');
      return;
    }
    
    try {
      // Close the client connection
      await this.client.close();
      
      // Clean up
      this.client = null;
      this.transport = null;
      this.initialized = false;
    } catch (error) {
      console.error('Error disconnecting from MCP server:', error);
    }
  }
}

export { MCPClient, MCPServerConfig, MCPTool }; 