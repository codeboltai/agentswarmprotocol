/**
 * Example of using the Swarm Client SDK
 * 
 * This example demonstrates how to:
 * 1. Initialize the client
 * 2. List available agents
 * 3. Send a task to the conversation agent
 * 4. Execute a workflow
 */

require('dotenv').config({ path: '../../../.env' });
const { createClient } = require('../../../sdk');

async function main() {
  // Create and connect to the client
  const client = createClient({
    orchestratorUrl: process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001'
  });
  
  try {
    // Connect to the orchestrator
    console.log('Connecting to orchestrator...');
    await client.connect();
    console.log('Connected to orchestrator');
    
    // Set up event handlers
    client.on('message', (message) => {
      console.log('Received message:', JSON.stringify(message, null, 2));
    });
    
    // List available agents
    console.log('\nListing available agents...');
    const agents = await client.getAgents();
    
    console.log('Available agents:');
    agents.forEach(agent => {
      console.log(`- ${agent.name} (${agent.capabilities.join(', ')})`);
    });
    
    // Find the conversation agent
    const conversationAgent = agents.find(agent => agent.name === 'conversation-agent');
    
    if (conversationAgent) {
      console.log('\nSending a task to the conversation agent...');
      
      // Create a unique conversation ID
      const conversationId = `test-${Date.now()}`;
      
      // Send a simple message
      const result = await client.sendTask('conversation-agent', {
        conversationId,
        message: 'Hello, how are you today?',
        context: {
          userData: {
            name: 'SDK User'
          },
          preferences: {
            formality: 'casual',
            verbosity: 'balanced'
          }
        }
      });
      
      console.log('Task result:', result);
      
      // Continue the conversation if there was a response
      if (result.result && result.result.response) {
        console.log('\nContinuing the conversation...');
        
        const followUpResult = await client.sendTask('conversation-agent', {
          conversationId,
          message: 'Tell me a fun fact about AI',
          context: {
            userData: {
              name: 'SDK User'
            },
            preferences: {
              formality: 'casual',
              verbosity: 'detailed'
            }
          }
        });
        
        console.log('Follow-up result:', followUpResult);
      }
    } else {
      console.log('Conversation agent not found');
    }
    
    // Execute a workflow if any are available
    try {
      console.log('\nExecuting a sample workflow...');
      
      const workflowResult = await client.executeWorkflow('sample-workflow', {
        initialMessage: 'Start the workflow with this message',
        parameters: {
          key1: 'value1',
          key2: 'value2'
        }
      });
      
      console.log('Workflow result:', workflowResult);
    } catch (error) {
      console.log('No workflows available or error executing workflow:', error.message);
    }
    
    // Disconnect
    console.log('\nDisconnecting from orchestrator...');
    client.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    client.disconnect();
  }
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 