const { Client } = require('@modelcontextprotocol/sdk/dist/cjs/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/dist/cjs/client/stdio.js');

async function testMCPConnection() {
  console.log('Testing MCP connection with official SDK...');
  
  try {
    // Create transport
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/utkarshshukla/Codebolt/agentswarmprotocol']
    });

    // Create client
    const client = new Client(
      {
        name: 'test-mcp-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('Connected successfully!');

    console.log('Listing tools...');
    const tools = await client.listTools();
    console.log('Tools:', JSON.stringify(tools, null, 2));

    if (tools.tools && tools.tools.length > 0) {
      const firstTool = tools.tools[0];
      console.log(`Testing tool: ${firstTool.name}`);
      
      try {
        const result = await client.callTool({
          name: firstTool.name,
          arguments: { path: '.' }
        });
        console.log('Tool result:', JSON.stringify(result, null, 2));
      } catch (toolError) {
        console.error('Tool execution error:', toolError.message);
      }
    }

    console.log('Closing connection...');
    await client.close();
    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMCPConnection(); 