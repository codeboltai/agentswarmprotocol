/**
 * Conversation Agent for Agent Swarm Protocol
 * Provides conversational capabilities with memory and context awareness
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the Conversation Agent
const ConversationAgent = require('./conversation-agent');

// Create and start the conversation agent
async function startConversationAgent() {
  try {
    console.log('Starting conversation agent...');
    
    // Create the conversation agent with configuration
    const agent = new ConversationAgent({
      name: process.env.AGENT_NAME || 'Conversation Agent',
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
      autoReconnect: true
    });
    
    // Register additional event handlers
    agent.on('connected', () => {
      console.log('Conversation agent connected to orchestrator');
    });
    
    agent.on('registered', (data) => {
      console.log(`Conversation agent registered with ID: ${agent.agentId}`);
      console.log(`Registration details: ${JSON.stringify(data)}`);
    });
    
    agent.on('task', (task) => {
      console.log(`Received task: ${JSON.stringify(task)}`);
    });
    
    agent.on('task-sent', (taskId, result) => {
      console.log(`Task ${taskId} result sent: ${JSON.stringify(result)}`);
    });
    
    agent.on('message', (message) => {
      console.log(`Received message: ${JSON.stringify(message)}`);
    });
    
    agent.on('disconnected', () => {
      console.log('Conversation agent disconnected from orchestrator');
    });
    
    agent.on('error', (error) => {
      console.error('Conversation agent error:', error.message);
    });
    
    // Connect to the orchestrator
    await agent.connect();
    console.log('Conversation agent started successfully');
    console.log('Connection URL:', process.env.ORCHESTRATOR_URL || 'ws://localhost:3000');
    
    return agent;
  } catch (error) {
    console.error('Failed to start conversation agent:', error.message);
    throw error;
  }
}

// Start the agent if this is the main module
if (require.main === module) {
  startConversationAgent()
    .then(agent => {
      console.log('Conversation agent is running...');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('Shutting down conversation agent...');
        agent.disconnect();
        process.exit(0);
      });
  })
  .catch(error => {
      console.error('Error starting conversation agent:', error);
    process.exit(1);
  });
}

module.exports = { startConversationAgent }; 