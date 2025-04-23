/**
 * Example script for running a Summarization Agent using the Swarm Agent SDK.
 * This script demonstrates how to create, connect, and use a Summarization Agent.
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the SDK
const { createSummarizationAgent } = require('../index');

/**
 * Main function to run the Summarization Agent
 */
async function main() {
  try {
    console.log('Starting Summarization Agent...');

    // Create the summarization agent
    const agent = createSummarizationAgent({
      name: 'summarization-agent-example',
      defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
    });

    // Register event handlers
    agent.on('task', async (message) => {
      console.log(`Received summarization task with ID: ${message.id}`);
      
      try {
        // Example of handling a summarization task
        const content = message.data.content;
        const options = message.data.options || { 
          type: 'concise', 
          maxLength: 500,
          format: 'text'
        };
        
        if (!content) {
          throw new Error('No content provided for summarization');
        }
        
        // Generate summary using the agent's built-in method
        const summary = await agent.generateSummary(content, options);
        
        // Send the results back to the orchestrator
        agent.sendTaskResult(message.id, {
          originalLength: content.length,
          summaryLength: summary.length,
          summary,
          options
        });
        
        console.log(`Summarization task ${message.id} completed successfully`);
      } catch (error) {
        console.error(`Error processing summarization task: ${error.message}`);
        agent.sendTaskError(message.id, error);
      }
    });

    agent.on('error', (error) => {
      console.error('Summarization Agent error:', error);
    });

    // Connect to the orchestrator
    await agent.connect();
    console.log('Summarization Agent connected to orchestrator');

    // Keep the process running
    console.log('Summarization Agent is running. Press Ctrl+C to exit.');
  } catch (error) {
    console.error('Failed to start Summarization Agent:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down Summarization Agent...');
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