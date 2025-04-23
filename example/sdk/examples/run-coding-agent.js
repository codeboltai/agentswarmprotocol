/**
 * Example script for running a Coding Agent using the Swarm Agent SDK.
 * This script demonstrates how to create, connect, and use a Coding Agent.
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the SDK
const { createCodingAgent } = require('../index');

/**
 * Main function to run the Coding Agent
 */
async function main() {
  try {
    console.log('Starting Coding Agent...');

    // Create the coding agent
    const agent = createCodingAgent({
      name: 'coding-agent-example',
      defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
    });

    // Register event handlers
    agent.on('task', async (message) => {
      console.log(`Received coding task with ID: ${message.id}`);
      
      try {
        // Example of handling a coding task
        const { task, language, constraints } = message.data;
        
        if (!task) {
          throw new Error('No coding task specified');
        }
        
        console.log(`Working on coding task: ${task}`);
        console.log(`Language: ${language || 'Not specified, using default'}`);
        
        // Generate code using the agent's built-in method
        const result = await agent.generateCode(task, {
          language: language || 'javascript',
          constraints: constraints || [],
          includeTests: true,
          optimizeFor: 'readability'
        });
        
        // Send the results back to the orchestrator
        agent.sendTaskResult(message.id, {
          code: result.code,
          explanation: result.explanation,
          tests: result.tests
        });
        
        console.log(`Coding task ${message.id} completed successfully`);
      } catch (error) {
        console.error(`Error processing coding task: ${error.message}`);
        agent.sendTaskError(message.id, error);
      }
    });

    agent.on('error', (error) => {
      console.error('Coding Agent error:', error);
    });

    // Connect to the orchestrator
    await agent.connect();
    console.log('Coding Agent connected to orchestrator');

    // Keep the process running
    console.log('Coding Agent is running. Press Ctrl+C to exit.');
  } catch (error) {
    console.error('Failed to start Coding Agent:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down Coding Agent...');
  try {
    // Add any cleanup tasks here
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main }; 