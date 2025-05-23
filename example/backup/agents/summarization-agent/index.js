/**
 * Summarization Agent for Agent Swarm Protocol
 * Summarizes content and extracts key information
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the Summarization Agent
const SummarizationAgent = require('./summarization-agent');

// Create and start the summarization agent
async function startSummarizationAgent() {
  try {
    console.log('Starting summarization agent...');
    
    // Create the summarization agent with configuration
    const agent = new SummarizationAgent({
      name: process.env.AGENT_NAME || 'Summarization Agent',
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
      autoReconnect: true
    });
    
    // Register additional event handlers
    agent.on('connected', () => {
      console.log('Summarization agent connected to orchestrator');
    });
    
    agent.on('registered', (data) => {
      console.log(`Summarization agent registered with ID: ${agent.agentId}`);
    });
    
    agent.on('task', (task) => {
      console.log(`Received task: ${JSON.stringify(task)}`);
    });
    
    agent.on('disconnected', () => {
      console.log('Summarization agent disconnected from orchestrator');
    });
    
    agent.on('error', (error) => {
      console.error('Summarization agent error:', error.message);
    });
    
    // Connect to the orchestrator
    await agent.connect();
    console.log('Summarization agent started successfully');
    
    return agent;
  } catch (error) {
    console.error('Failed to start summarization agent:', error.message);
    throw error;
  }
}

// Start the agent if this is the main module
if (require.main === module) {
  startSummarizationAgent()
    .then(agent => {
      console.log('Summarization agent is running...');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('Shutting down summarization agent...');
        agent.disconnect();
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Error starting summarization agent:', error);
      process.exit(1);
    });
}

module.exports = { startSummarizationAgent }; 