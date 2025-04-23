/**
 * Summarization Agent for ASP
 * Summarizes content and extracts key information
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the Swarm Agent SDK
const { createSummarizationAgent } = require('../../sdk');

// Create and start the summarization agent
async function startSummarizationAgent() {
  try {
    console.log('Starting summarization agent...');
    
    const agent = createSummarizationAgent({
      // Override the name if needed
      // name: 'custom-summarization-agent',
      
      // Use values from environment or defaults
      defaultModel: process.env.DEFAULT_MODEL,
      orchestratorUrl: process.env.ORCHESTRATOR_URL
    });
    
    // Register additional event handlers if needed
    agent.on('task', (message) => {
      console.log(`Handling task: ${message.type}`);
    });
    
    agent.on('error', (error) => {
      console.error('Agent error:', error);
    });
    
    // Connect to the orchestrator and register
    await agent.connect();
    console.log('Agent connected and registered with the orchestrator');
    
    return agent;
  } catch (error) {
    console.error('Failed to start agent:', error);
    throw error;
  }
}

// Start the agent if this is the main module
if (require.main === module) {
  startSummarizationAgent()
    .then(agent => {
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('Shutting down summarization agent...');
        agent.disconnect();
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Error starting agent:', error);
      process.exit(1);
    });
}

module.exports = { startSummarizationAgent }; 