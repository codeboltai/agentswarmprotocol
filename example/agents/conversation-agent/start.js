#!/usr/bin/env node
/**
 * Conversation Agent - Startup Script
 * 
 * This script initializes and runs the Conversation Agent, connecting
 * it to the Agent Swarm Protocol orchestrator.
 */

require('dotenv').config();
const ConversationAgent = require('./index');

// Get configuration from environment variables
const config = {
  agentId: process.env.AGENT_ID || `conversation-agent-${Math.random().toString(36).substring(2, 9)}`,
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
  debug: process.env.DEBUG === 'true'
};

async function main() {
  // Create and initialize the conversation agent
  const agent = new ConversationAgent(config);
  
  // Set up event handlers
  agent.on('connected', () => {
    console.log(`[ConversationAgent] Connected to orchestrator at ${config.orchestratorUrl}`);
    console.log(`[ConversationAgent] Agent ID: ${agent.agentId}`);
    console.log(`[ConversationAgent] Type: ${agent.agentType}`);
    console.log(`[ConversationAgent] Capabilities: ${agent.capabilities.join(', ')}`);
  });

  agent.on('disconnected', (code, reason) => {
    console.log(`[ConversationAgent] Disconnected: ${reason} (${code})`);
    
    // Attempt to reconnect if not shutting down
    if (code !== 1000) {
      console.log('[ConversationAgent] Attempting to reconnect in 5 seconds...');
      setTimeout(() => {
        if (!agent.connected) {
          agent.connect();
        }
      }, 5000);
    }
  });

  agent.on('error', (error) => {
    console.error('[ConversationAgent] Error:', error.message);
  });

  agent.on('task', (task) => {
    if (config.debug) {
      console.log(`[ConversationAgent] Received task: ${task.taskId} (${task.taskType})`);
    }
  });

  agent.on('task_result', (taskId, result) => {
    if (config.debug) {
      console.log(`[ConversationAgent] Task ${taskId} completed with result:`, 
        JSON.stringify(result, null, 2));
    }
  });

  // Connect to the orchestrator
  try {
    await agent.connect();
  } catch (error) {
    console.error('[ConversationAgent] Failed to connect:', error.message);
    process.exit(1);
  }

  // Handle shutdown signals
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  function handleShutdown() {
    console.log('[ConversationAgent] Shutting down...');
    agent.disconnect()
      .then(() => {
        console.log('[ConversationAgent] Disconnected successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('[ConversationAgent] Error during shutdown:', error.message);
        process.exit(1);
      });
  }
}

// Start the agent
main().catch(error => {
  console.error('[ConversationAgent] Fatal error:', error);
  process.exit(1);
}); 