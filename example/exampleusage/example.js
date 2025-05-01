/**
 * Example showing how agents can use MCP features in ASP Orchestrator
 */

// Example agent SDK communication with orchestrator (pseudo-code)
async function exampleAgentMCPUsage() {
  // Step 1: Register a MCP server
  const registerServerResponse = await sendServiceRequest('mcp-service', {
    action: 'register-server',
    name: 'weather-server',
    path: '/path/to/weather-server.js',
    type: 'node',
    capabilities: ['get-weather', 'forecast']
  });
  
  console.log('Registered MCP server:', registerServerResponse);
  const serverId = registerServerResponse.serverId;
  
  // Step 2: Connect to the MCP server
  const connectResponse = await sendServiceRequest('mcp-service', {
    action: 'connect-server',
    serverId
  });
  
  console.log('Connected to MCP server:', connectResponse);
  
  // Step 3: List available tools
  const toolsResponse = await sendServiceRequest('mcp-service', {
    action: 'list-tools',
    serverId
  });
  
  console.log('Available MCP tools:', toolsResponse.tools);
  
  // Step 4: Execute a tool
  const executeResponse = await sendServiceRequest('mcp-service', {
    action: 'execute-tool',
    serverId,
    toolName: 'get-weather',
    toolArgs: {
      location: 'New York',
      units: 'metric'
    }
  });
  
  console.log('MCP tool execution initiated:', executeResponse);
  
  // Step 5: Track task status and wait for completion
  let taskCompleted = false;
  const taskId = executeResponse.taskId;
  
  while (!taskCompleted) {
    const taskStatus = await getTaskStatus(taskId);
    
    if (taskStatus.status === 'completed') {
      console.log('MCP task completed:', taskStatus.result);
      taskCompleted = true;
    } else if (taskStatus.status === 'failed') {
      console.error('MCP task failed:', taskStatus.error);
      taskCompleted = true;
    } else {
      console.log('MCP task in progress...');
      await sleep(1000); // Wait before checking again
    }
  }
  
  // Step 6: Using a different MCP server by name
  const weatherToolResponse = await sendServiceRequest('mcp-service', {
    action: 'execute-tool',
    mcpServerName: 'weather-server',
    toolName: 'forecast',
    toolArgs: {
      location: 'San Francisco',
      days: 5
    }
  });
  
  console.log('Weather forecast task initiated:', weatherToolResponse);
  
  // Step 7: Disconnect from MCP server when done
  const disconnectResponse = await sendServiceRequest('mcp-service', {
    action: 'disconnect-server',
    serverId
  });
  
  console.log('Disconnected from MCP server:', disconnectResponse);
}

// ============= HELPER FUNCTIONS (MOCK SDK) =============

/**
 * Example function to send a service request to orchestrator
 * This would be implemented in the actual agent SDK
 */
async function sendServiceRequest(service, params) {
  console.log(`Sending service request to ${service} with params:`, params);
  
  // In a real implementation, this would send the request to the orchestrator
  // and wait for a response
  
  // Simulate a response
  return {
    success: true,
    // Add appropriate fields based on the request
    ...(params.action === 'register-server' && {
      serverId: 'mock-server-id-123',
      name: params.name,
      status: 'registered'
    }),
    ...(params.action === 'connect-server' && {
      serverId: params.serverId,
      status: 'connected',
      tools: [
        {
          name: 'get-weather',
          description: 'Get current weather for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              units: { type: 'string', enum: ['metric', 'imperial'] }
            },
            required: ['location']
          }
        },
        {
          name: 'forecast',
          description: 'Get weather forecast for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              days: { type: 'number', minimum: 1, maximum: 10 }
            },
            required: ['location']
          }
        }
      ]
    }),
    ...(params.action === 'list-tools' && {
      tools: [
        {
          name: 'get-weather',
          description: 'Get current weather for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              units: { type: 'string', enum: ['metric', 'imperial'] }
            },
            required: ['location']
          }
        },
        {
          name: 'forecast',
          description: 'Get weather forecast for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              days: { type: 'number', minimum: 1, maximum: 10 }
            },
            required: ['location']
          }
        }
      ]
    }),
    ...(params.action === 'execute-tool' && {
      taskId: 'mock-task-id-' + Math.floor(Math.random() * 1000),
      status: 'pending',
      message: `MCP tool execution initiated: ${params.toolName}`
    }),
    ...(params.action === 'disconnect-server' && {
      serverId: params.serverId,
      status: 'disconnected'
    })
  };
}

/**
 * Example function to get task status from orchestrator
 * This would be implemented in the actual agent SDK
 */
async function getTaskStatus(taskId) {
  console.log(`Getting status for task: ${taskId}`);
  
  // In a real implementation, this would request the task status from the orchestrator
  
  // Simulate a completed task after a few seconds
  const now = Date.now();
  const taskCreationTime = parseInt(taskId.split('-').pop()) * 100;
  const elapsed = now - taskCreationTime;
  
  if (elapsed > 3000) {
    return {
      taskId,
      status: 'completed',
      result: {
        data: {
          temperature: 22.5,
          conditions: 'Partly Cloudy',
          humidity: 65
        },
        timestamp: new Date().toISOString()
      }
    };
  } else {
    return {
      taskId,
      status: 'pending'
    };
  }
}

/**
 * Sleep helper function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example
if (require.main === module) {
  exampleAgentMCPUsage().catch(console.error);
} 