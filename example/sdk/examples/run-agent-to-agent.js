#!/usr/bin/env node
/**
 * Agent-to-Agent Communication Example
 * 
 * This example demonstrates how to set up agent-to-agent communication
 * where a Conversation Agent requests information from a Research Agent.
 */

require('dotenv').config();
const { createClient } = require('../../sdk');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_CLIENT_URL || 'ws://localhost:3001';

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Main function
async function main() {
  console.log('Agent-to-Agent Communication Example');
  console.log('====================================');
  console.log('This example demonstrates communication between Conversation and Research agents');

  try {
    // Initialize the client
    console.log(`\nConnecting to orchestrator at ${ORCHESTRATOR_URL}...`);
    const client = createClient({
      orchestratorUrl: ORCHESTRATOR_URL
    });

    // Set up event handlers
    client.on('connected', () => {
      console.log('Connected to orchestrator');
    });

    client.on('disconnected', () => {
      console.log('Disconnected from orchestrator');
    });

    client.on('task-result', (result) => {
      console.log('\nTask Result:');
      console.log(JSON.stringify(result, null, 2));
    });

    // Connect to the orchestrator
    await client.connect();

    // Get available agents
    console.log('\nRetrieving available agents...');
    const agents = await client.getAgents();
    
    // Find the conversation agent
    const conversationAgent = agents.find(agent => agent.name === 'Conversation Agent');
    if (!conversationAgent) {
      throw new Error('Conversation Agent not found. Make sure it is running and connected to the orchestrator.');
    }
    
    // Find the research agent
    const researchAgent = agents.find(agent => agent.name === 'Research Agent');
    if (!researchAgent) {
      throw new Error('Research Agent not found. Make sure it is running and connected to the orchestrator.');
    }
    
    console.log(`\nFound Conversation Agent: ${conversationAgent.name}`);
    console.log(`Found Research Agent: ${researchAgent.name}`);

    // Start a conversation session
    const conversationId = `conv-${uuidv4()}`;
    console.log(`\nStarting conversation with ID: ${conversationId}`);
    
    // Initialize conversation
    await client.sendTask(conversationAgent.name, {
      taskType: 'conversation.start',
      conversationId,
      context: {
        userData: {
          name: await askQuestion('Enter your name: '),
          preferences: {
            verbosity: 'balanced',
            formality: 'casual'
          }
        }
      }
    });

    console.log('\nConversation started!');
    console.log('\nType your research questions. The conversation agent will collaborate with the research agent.');
    console.log('Type "exit" to end the conversation.');

    // Conversation loop
    let running = true;
    while (running) {
      const message = await askQuestion('\nYour message: ');
      
      if (message.toLowerCase() === 'exit') {
        running = false;
        continue;
      }

      // Send the message to the conversation agent
      try {
        const response = await client.sendTask(conversationAgent.name, {
          taskType: 'conversation.message',
          conversationId,
          message,
          context: {
            availableAgents: [
              {
                name: researchAgent.name,
                capabilities: researchAgent.capabilities
              }
            ]
          }
        });

        console.log(`\nAgent: ${response.result.response}`);
        
        // If there are actions, display them
        if (response.result.suggestedActions && response.result.suggestedActions.length > 0) {
          console.log('\nSuggested actions:');
          response.result.suggestedActions.forEach(action => {
            console.log(`- ${action.label}`);
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }

    // End the conversation
    console.log('\nEnding conversation...');
    await client.sendTask(conversationAgent.name, {
      taskType: 'conversation.end',
      conversationId
    });

    console.log('\nConversation ended. Disconnecting...');
    client.disconnect();
    rl.close();

  } catch (error) {
    console.error('\nError:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the example
main().catch(console.error); 