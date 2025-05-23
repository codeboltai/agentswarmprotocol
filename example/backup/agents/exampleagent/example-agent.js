/**
 * Example Agent - Demonstrates how to use the SwarmAgentSDK
 */

const SwarmAgentSDK = require('./');

// Create a new agent instance
const agent = new SwarmAgentSDK({
  name: 'Example Agent',
  capabilities: ['text-processing', 'summarization'],
  description: 'An example agent for demonstration',
  manifest: {
    version: '1.0.0',
    requiredServices: ['storage-service', 'mcp-service']
  },
  orchestratorUrl: 'ws://localhost:3000', // Default value
  autoReconnect: true
});

// Event handlers for connection lifecycle
agent.on('connected', () => {
  console.log('Connected to the orchestrator');
});

agent.on('registered', (data) => {
  console.log(`Agent registered with ID: ${agent.agentId}`);
  console.log('Registration data:', data);
});

agent.on('disconnected', () => {
  console.log('Disconnected from the orchestrator');
});

agent.on('error', (error) => {
  console.error('Error:', error.message);
});

agent.on('welcome', (welcomeMessage) => {
  console.log('Welcome message:', welcomeMessage);
});

// Register task handlers
agent.registerTaskHandler('text-summarization', async (input, metadata) => {
  console.log('Handling text summarization task');
  console.log('Input:', input);
  console.log('Metadata:', metadata);
  
  // Simulate processing
  const text = input.text || '';
  
  // Simple summarization (just for demo)
  const summary = text.length > 100 
    ? text.substring(0, 100) + '...' 
    : text;
  
  // Return the task result
  return {
    summary,
    originalLength: text.length,
    summaryLength: summary.length
  };
});

// Register a default handler for any unhandled task types
agent.registerDefaultTaskHandler(async (input, metadata) => {
  console.log('Handling default task');
  console.log('Input:', input);
  
  return {
    status: 'completed',
    message: `Processed task of type: ${input.taskType}`,
    receivedInput: input
  };
});

// Listen for task assignments
agent.on('task', (task) => {
  console.log('New task received:', task);
});

// Example function to communicate with another agent
async function collaborateWithAgent(targetAgentName, data) {
  try {
    console.log(`Requesting task from ${targetAgentName}...`);
    const result = await agent.requestAgentTask(targetAgentName, {
      taskType: 'collaboration',
      data
    });
    console.log('Task result:', result);
    return result;
  } catch (error) {
    console.error('Collaboration failed:', error.message);
    throw error;
  }
}

// Example function to use a service
async function useStorageService(operation, data) {
  try {
    console.log(`Requesting storage service: ${operation}...`);
    const result = await agent.requestService('storage-service', {
      operation,
      data
    });
    console.log('Service result:', result);
    return result;
  } catch (error) {
    console.error('Service request failed:', error.message);
    throw error;
  }
}

// Example function to use MCP service
async function useMCPService() {
  try {
    console.log('Listing available MCP servers...');
    const result = await agent.requestMCPService({
      action: 'list-servers'
    });
    console.log('MCP Servers:', result.servers);
    return result;
  } catch (error) {
    console.error('MCP service request failed:', error.message);
    throw error;
  }
}

// Connect to the orchestrator
async function start() {
  try {
    await agent.connect();
    console.log('Agent started successfully');
    
    // Example: List all available agents after a delay
    setTimeout(async () => {
      try {
        const agents = await agent.getAgentList();
        console.log('Available agents:', agents);
      } catch (error) {
        console.error('Failed to get agent list:', error.message);
      }
    }, 5000);
    
  } catch (error) {
    console.error('Failed to start agent:', error.message);
  }
}

// Start the agent
start();

// Handle termination
process.on('SIGINT', () => {
  console.log('Disconnecting agent...');
  agent.disconnect();
  process.exit(0);
});

module.exports = {
  agent,
  collaborateWithAgent,
  useStorageService,
  useMCPService
}; 