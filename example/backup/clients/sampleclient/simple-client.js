/**
 * Simple example of using the SwarmClientSDK
 * 
 * This example connects to an orchestrator, gets a list of agents,
 * and sends a task to an agent.
 */

const SwarmClientSDK = require('../index');

// Create a new client
const client = new SwarmClientSDK({
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3001'
});

// Setup event listeners
client.on('connected', () => {
  console.log('Connected to orchestrator');
});

client.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

client.on('error', (error) => {
  console.error('Error:', error);
});

client.on('welcome', (content) => {
  console.log('Received welcome message:', content);
});

client.on('task-result', (result) => {
  console.log('Received task result:', result);
});

// Main function
async function main() {
  try {
    // Connect to the orchestrator
    await client.connect();
    console.log('Client ID:', client.getClientId());
    
    // Get a list of agents
    const agents = await client.getAgents();
    console.log('Available agents:', agents);
    
    // If there are any agents, send a task to the first one
    if (agents && agents.length > 0) {
      const agentName = agents[0].name;
      console.log(`Sending task to agent "${agentName}"...`);
      
      const result = await client.sendTask(agentName, {
        taskType: 'echo',
        message: 'Hello from SwarmClientSDK!'
      }, { waitForResult: true, timeout: 10000 });
      
      console.log('Task result:', result);
    } else {
      console.log('No agents available');
    }
    
    // List MCP servers
    try {
      const mcpServers = await client.listMCPServers();
      console.log('Available MCP servers:', mcpServers);
    } catch (error) {
      console.error('Error listing MCP servers:', error.message);
    }
    
    // Subscribe to notifications for 5 seconds
    console.log('Subscribing to notifications for 5 seconds...');
    const unsubscribe = client.subscribeToNotifications((notification) => {
      console.log('Received notification:', notification);
    });
    
    // Wait for 5 seconds, then unsubscribe and disconnect
    await new Promise(resolve => setTimeout(resolve, 5000));
    unsubscribe();
    
    // Disconnect
    client.disconnect();
    
  } catch (error) {
    console.error('Error in main function:', error);
    client.disconnect();
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 