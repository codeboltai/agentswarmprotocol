/**
 * Service Check - Test script to identify available services
 */
const SwarmAgentSDK = require('../../sdk/agentsdk');

// Initialize a test agent
const agent = new SwarmAgentSDK({
  name: 'Service Check Agent',
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
  autoReconnect: false,
});

// Debug message logging
agent.on('message', (message) => {
  console.log('DEBUG - Received message:', JSON.stringify(message, null, 2));
});

// Error logging
agent.on('error', (error) => {
  console.error('ERROR:', error.message);
});

// Connect and test services
async function checkServices() {
  try {
    console.log('Connecting to orchestrator...');
    await agent.connect();
    console.log('Connected successfully!');
    
    // Wait for registration to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test all possible service methods
    console.log('\n--- Testing service methods ---');
    const services = [
      'agent-list',
      'service-list',
      'mcp-service',
      'get-services',
      'list-services',
      'list-agents'
    ];
    
    for (const serviceName of services) {
      try {
        console.log(`\nTesting service: ${serviceName}`);
        const result = await agent.requestService(serviceName, { filters: {} });
        console.log(`Result: ${JSON.stringify(result, null, 2)}`);
      } catch (error) {
        console.log(`Error with service ${serviceName}: ${error.message}`);
      }
    }
    
    // Test direct MCP server list
    console.log('\n--- Testing direct MCP server list ---');
    try {
      const message = {
        type: 'mcp.servers.list.request',
        content: { filters: {} }
      };
      const result = await agent.sendAndWaitForResponse(message, 5000);
      console.log('Direct MCP server list result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('Error with direct MCP server list:', error.message);
    }
    
    // Try to list agents directly
    console.log('\n--- Testing agent list direct method ---');
    try {
      const agents = await agent.getAgentList();
      console.log('Agents:', JSON.stringify(agents, null, 2));
    } catch (error) {
      console.log('Error getting agent list:', error.message);
    }
    
    console.log('\nService check completed');
  } catch (error) {
    console.error('Failed to run service check:', error);
  } finally {
    agent.disconnect();
  }
}

// Run tests
checkServices().catch(console.error); 