/**
 * Research Agent for ASP
 * Performs web searches and research tasks
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the Swarm Agent SDK
const { createResearchAgent } = require('../../sdk');

// Create and start the research agent
async function startResearchAgent() {
  try {
    console.log('Starting research agent...');
    
    const agent = createResearchAgent({
      // Override the name if needed
      // name: 'custom-research-agent',
      
      // Use values from environment or defaults
      defaultModel: process.env.DEFAULT_MODEL,
      orchestratorUrl: process.env.ORCHESTRATOR_URL,
      searchApiKey: process.env.SEARCH_API_KEY
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
  startResearchAgent()
    .then(agent => {
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('Shutting down research agent...');
        agent.disconnect();
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Error starting agent:', error);
      process.exit(1);
    });
}

module.exports = { startResearchAgent }; 