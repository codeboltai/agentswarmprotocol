/**
 * Agent SDK Direct Test Script
 * 
 * This script tests the core functionality of the @agentswarmprotocol/agentsdk
 */

const SwarmAgentSDK = require('@agentswarmprotocol/agentsdk').default;

// Define AgentStatus locally to avoid dependency issues
const AgentStatus = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
  ERROR: 'error'
};

// Configuration for test agent
const config = {
  name: 'Test Agent',
  agentType: 'test',
  capabilities: ['testing', 'debugging'],
  description: 'An agent for testing SDK functionality',
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true,
  reconnectInterval: 3000,
  logger: console
};

// Create a test agent instance
const agent = new SwarmAgentSDK(config);

// Event Listeners
agent.on('connected', () => {
  console.log('✅ Connected to orchestrator');
  runTests();
});

agent.on('disconnected', () => {
  console.log('❌ Disconnected from orchestrator');
});

agent.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

agent.on('registered', (data) => {
  console.log('✅ Agent registered with ID:', agent.agentId);
});

agent.on('task', (taskData, message) => {
  console.log('✅ Received task:', taskData);
  console.log('Responding to task...');
  agent.sendTaskResult(message.id, { success: true, result: 'Task completed' });
});

// Message handler for specific message type
agent.onMessage('test.message', (content, message) => {
  console.log('✅ Received test message:', content);
  console.log('Message ID:', message.id);
});

// Task handler for specific task type
agent.registerTaskHandler('test.task', (taskData, taskId) => {
  console.log('✅ Handling test.task:', taskData);
  console.log('Task ID:', taskId);
  return { success: true, data: 'Test task completed' };
});

// Default task handler
agent.registerDefaultTaskHandler((taskData, taskId) => {
  console.log('✅ Default task handler called:', taskData);
  console.log('Task ID:', taskId);
  return { success: true, data: 'Default handler executed' };
});

// Safely execute a test and handle potential errors
async function safeExecuteTest(testName, testFn) {
  console.log(`Test: ${testName}`);
  try {
    await testFn();
    console.log(`✅ ${testName} completed successfully\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${testName} failed: ${error.message}\n`);
    return false;
  }
}

// Main test function
async function runTests() {
  try {
    console.log('\n--- AGENT SDK TEST SUITE ---\n');
    
    // Test: Send a simple message
    await safeExecuteTest('Sending a message', async () => {
      const response = await agent.send({
        type: 'pong',
        content: { message: 'Hello from test agent' }
      });
      console.log('Response:', response);
    });
    
    // Try to set status (may not be supported)
    await safeExecuteTest('Setting agent status', async () => {
      try {
        await agent.setStatus(AgentStatus.BUSY);
      } catch (error) {
        if (error.message.includes('Unsupported message type: agent.status')) {
          console.log('Note: agent.status message type not supported by the orchestrator');
        } else {
          throw error;
        }
      }
    });
    
    // Try to get agent list (may not be supported)
    let agents = [];
    await safeExecuteTest('Getting agent list', async () => {
      try {
        agents = await agent.getAgentList();
        console.log(`Found ${agents.length} agents`);
      } catch (error) {
        if (error.message.includes('Unsupported message type: agent.list')) {
          console.log('Note: agent.list message type not supported by the orchestrator');
        } else {
          throw error;
        }
      }
    });
    
    // Try to get service list (may not be supported)
    let services = [];
    await safeExecuteTest('Getting service list', async () => {
      try {
        services = await agent.getServiceList();
        console.log(`Found ${services.length} services`);
      } catch (error) {
        if (error.message.includes('Unsupported message type')) {
          console.log('Note: service.list message type not supported by the orchestrator');
        } else {
          throw error;
        }
      }
    });
    
    // Try to get MCP servers (may not be supported)
    let mcpServers = [];
    await safeExecuteTest('Getting MCP servers', async () => {
      try {
        mcpServers = await agent.getMCPServers();
        console.log(`Found ${mcpServers.length} MCP servers`);
      } catch (error) {
        if (error.message.includes('Unsupported message type')) {
          console.log('Note: mcp.servers message type not supported by the orchestrator');
        } else {
          throw error;
        }
      }
    });
    
    // Only proceed with MCP tool tests if servers are available
    if (mcpServers.length > 0) {
      const serverId = mcpServers[0].id;
      
      // Try to get MCP tools
      let mcpTools = [];
      await safeExecuteTest(`Getting MCP tools for server ${serverId}`, async () => {
        try {
          mcpTools = await agent.getMCPTools(serverId);
          console.log(`Found ${mcpTools.length} MCP tools`);
        } catch (error) {
          if (error.message.includes('Unsupported message type')) {
            console.log('Note: mcp.tools message type not supported by the orchestrator');
          } else {
            throw error;
          }
        }
      });
      
      // Try to execute MCP tool (if any available)
      if (mcpTools.length > 0) {
        const toolName = mcpTools[0].name;
        await safeExecuteTest(`Executing MCP tool ${toolName}`, async () => {
          try {
            const result = await agent.executeMCPTool(serverId, toolName, {});
            console.log('Tool execution result:', result);
          } catch (error) {
            if (error.message.includes('Unsupported message type')) {
              console.log('Note: mcp.execute message type not supported by the orchestrator');
            } else {
              throw error;
            }
          }
        });
      }
    }
    
    // Try to request agent task (if other agents available)
    if (agents.length > 1) {
      const targetAgent = agents.find(a => a.id !== agent.agentId);
      if (targetAgent) {
        await safeExecuteTest(`Requesting task from agent ${targetAgent.name}`, async () => {
          try {
            const result = await agent.requestAgentTask(targetAgent.name, {
              taskType: 'test.request',
              data: { test: 'data' }
            });
            console.log('Agent task result:', result);
          } catch (error) {
            if (error.message.includes('Unsupported message type')) {
              console.log('Note: agent.request message type not supported by the orchestrator');
            } else {
              throw error;
            }
          }
        });
      }
    }
    
    // Try to request service (if services available)
    if (services.length > 0) {
      const serviceName = services[0].name;
      await safeExecuteTest(`Requesting service ${serviceName}`, async () => {
        try {
          const result = await agent.requestService(serviceName, { test: 'data' });
          console.log('Service request result:', result);
        } catch (error) {
          if (error.message.includes('Unsupported message type')) {
            console.log('Note: service.request message type not supported by the orchestrator');
          } else {
            throw error;
          }
        }
      });
    }
    
    console.log('All tests completed!');
    
    // Try to set status back to AVAILABLE
    try {
      await agent.setStatus(AgentStatus.AVAILABLE);
    } catch (error) {
      // Ignore status setting errors
    }
    
    // After some delay, disconnect
    setTimeout(() => {
      console.log('Test completed, disconnecting...');
      agent.disconnect();
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    agent.disconnect();
    process.exit(1);
  }
}

// Connect to orchestrator
console.log('Connecting to orchestrator...');
agent.connect().catch(error => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});
