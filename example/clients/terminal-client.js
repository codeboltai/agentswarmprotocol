#!/usr/bin/env node
/**
 * Terminal Client for Agent Swarm Protocol
 * A command-line interface to interact with the ASP Orchestrator
 * Using the SwarmClientSDK
 */

// Load environment variables
require('dotenv').config({ path: '../.env' });

// Import components
const state = require('./models/state');
const { rl, displayPrompt, showHelp } = require('./utils/helpers');
const { connect, disconnect, listMCPServers } = require('./utils/connection');
const chatHandler = require('./handlers/chat-handler');
const taskHandler = require('./handlers/task-handler');

// Main function
async function main() {
  state.running = true;
  
  console.log('\nAgent Swarm Protocol Terminal Client');
  console.log('Type "help" to see available commands.');
  
  const connected = await connect();
  if (!connected) {
    console.log('Failed to connect to orchestrator. Exiting...');
    state.running = false;
    rl.close();
    return;
  }
  
  displayPrompt();
  
  rl.on('line', async (line) => {
    // If we're in a chat session, let the chat handler deal with input
    if (state.chatState.inChatSession) {
      return;
    }

    const command = line.trim().toLowerCase();
    
    try {
      switch (command) {
        case 'agents':
          await chatHandler.listAgents();
          break;
          
        case 'task':
          await taskHandler.sendTask();
          break;
          
        case 'chat':
          await chatHandler.startChatSession();
          break;
          
        case 'status':
          await taskHandler.checkTaskStatus();
          break;
          
        case 'mcp':
          await listMCPServers();
          break;
          
        case 'help':
          showHelp();
          break;
          
        case 'exit':
          console.log('Exiting...');
          state.running = false;
          disconnect();
          rl.close();
          return;
          
        case '':
          // Ignore empty lines
          break;
          
        default:
          console.log(`Unknown command: ${command}`);
          console.log('Type "help" to see available commands.');
      }
    } catch (error) {
      console.error(`Error executing command: ${error.message}`);
    }
    
    displayPrompt();
  });
}

// Run the client
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});