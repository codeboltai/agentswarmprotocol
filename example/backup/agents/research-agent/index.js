/**
 * Research Agent for Agent Swarm Protocol
 * Performs research, analysis, and reporting tasks
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the Research Agent
const ResearchAgent = require('./research-agent');

// Create and start the research agent
async function startResearchAgent() {
  try {
    console.log('Starting research agent...');
    
    // Create the research agent with configuration
    const agent = new ResearchAgent({
      name: process.env.AGENT_NAME || 'Research Agent',
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
      autoReconnect: true
    });
    
    // Register additional event handlers
    agent.on('connected', () => {
      console.log('Research agent connected to orchestrator');
    });
    
    agent.on('registered', (data) => {
      console.log(`Research agent registered with ID: ${agent.agentId}`);
    });
    
    agent.on('task', (task) => {
      console.log(`Received task: ${JSON.stringify(task)}`);
    });
    
    agent.on('disconnected', () => {
      console.log('Research agent disconnected from orchestrator');
    });
    
    agent.on('error', (error) => {
      console.error('Research agent error:', error.message);
    });
    
    // Connect to the orchestrator
    await agent.connect();
    console.log('Research agent started successfully');
    
    return agent;
  } catch (error) {
    console.error('Failed to start research agent:', error.message);
    throw error;
  }
}

// Start the agent if this is the main module
if (require.main === module) {
  startResearchAgent()
    .then(agent => {
      console.log('Research agent is running...');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('Shutting down research agent...');
        agent.disconnect();
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Error starting research agent:', error);
      process.exit(1);
    });
}

module.exports = { startResearchAgent }; 