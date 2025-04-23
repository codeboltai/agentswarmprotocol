/**
 * Example client for the Conversation Agent
 * 
 * This example demonstrates how to:
 * 1. Initialize the Swarm SDK client
 * 2. Send tasks to the conversation agent
 * 3. Handle responses from the agent
 * 4. Manage conversation context and preferences
 */

require('dotenv').config({ path: '../../../.env' });
const { createClient } = require('../../../sdk');
const readline = require('readline');

// Create CLI interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to get user input
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('Conversation Agent Client Demo');
  console.log('------------------------------');
  
  try {
    // Initialize the client
    const client = createClient({
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
    });
    
    // Connect to the orchestrator
    await client.connect();
    console.log('Connected to the orchestrator');
    
    // Generate a unique conversation ID
    const conversationId = `conversation-${Date.now()}`;
    console.log(`Conversation ID: ${conversationId}`);
    
    // Set initial user data and preferences
    let userData = {};
    let preferences = {
      formality: 'casual',
      verbosity: 'balanced'
    };
    
    // Ask for the user's name to personalize the conversation
    const name = await askQuestion('What is your name? ');
    userData.name = name;
    console.log(`Hello, ${name}! You can now start chatting with the agent.`);
    console.log('Type "exit" to end the conversation, or "settings" to change your preferences.');
    
    let chatting = true;
    while (chatting) {
      // Get user input
      const userInput = await askQuestion('\nYou: ');
      
      // Exit command
      if (userInput.toLowerCase() === 'exit') {
        chatting = false;
        console.log('Ending conversation...');
        continue;
      }
      
      // Settings command
      if (userInput.toLowerCase() === 'settings') {
        const formalityOption = await askQuestion('Choose formality (formal/casual): ');
        if (formalityOption === 'formal' || formalityOption === 'casual') {
          preferences.formality = formalityOption;
        }
        
        const verbosityOption = await askQuestion('Choose verbosity (concise/balanced/detailed): ');
        if (['concise', 'balanced', 'detailed'].includes(verbosityOption)) {
          preferences.verbosity = verbosityOption;
        }
        
        console.log(`Preferences updated: ${JSON.stringify(preferences)}`);
        
        // Update the context with new preferences
        await client.sendTaskAndWaitForResponse({
          agentName: 'conversation-agent',
          taskData: {
            conversationId,
            context: {
              preferences
            }
          }
        });
        
        continue;
      }
      
      // Send message to the conversation agent
      const task = {
        agentName: 'conversation-agent',
        taskData: {
          conversationId,
          message: userInput,
          context: {
            userData,
            preferences
          }
        }
      };
      
      // Send the task and wait for a response
      const response = await client.sendTaskAndWaitForResponse(task);
      
      // Display the agent's response
      console.log(`\nAgent: ${response.response}`);
      
      // Handle suggested actions if any
      if (response.suggestedActions && response.suggestedActions.length > 0) {
        console.log('\nSuggested actions:');
        response.suggestedActions.forEach((action, index) => {
          console.log(`${index + 1}. ${action.label}`);
        });
      }
      
      // Apply any context updates from the response
      if (response.contextUpdates) {
        if (response.contextUpdates.userData) {
          userData = {
            ...userData,
            ...response.contextUpdates.userData
          };
        }
        
        if (response.contextUpdates.preferences) {
          preferences = {
            ...preferences,
            ...response.contextUpdates.preferences
          };
        }
      }
    }
    
    // Clean up
    rl.close();
    await client.disconnect();
    console.log('Disconnected from the orchestrator');
    
  } catch (error) {
    console.error('Error in conversation client:', error);
    rl.close();
    process.exit(1);
  }
}

// Start the client if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running conversation client:', error);
    process.exit(1);
  });
}

module.exports = { main }; 