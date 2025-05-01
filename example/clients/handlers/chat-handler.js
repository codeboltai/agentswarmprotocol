/**
 * Chat handler module for the terminal client
 * Handles chat-related functionality with agents
 */

const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const { select } = require('@inquirer/prompts');
const state = require('../models/state');
const { rl } = require('../utils/helpers');
const { displayChatMessage } = require('../utils/display');

/**
 * Handle chat response from agent
 * @param {Object} content - Response content from the agent
 */
function handleChatResponse(content) {
  console.log(`Processing chat response for task ID: ${content.taskId}`);
  
  // Debug: log the full content to understand its structure
  console.log(`Response content: ${JSON.stringify(content, null, 2)}`);
  
  let response = null;
  
  // Handle different response formats
  if (content.result) {
    if (content.result.response) {
      response = content.result.response;
    } else if (content.result.message) {
      response = content.result.message;
    } else if (typeof content.result === 'string') {
      response = content.result;
    }
  } else if (content.response) {
    response = content.response;
  } else if (content.message) {
    response = content.message;
  }
  
  if (!response) {
    console.log("\n❌ Agent didn't provide a valid response format");
    console.log("Please check the agent implementation to ensure it returns a response in the expected format.");
    console.log('\nType your message or "exit" to end the conversation:');
    process.stdout.write('> ');
    return;
  }

  // Add response to message history
  state.chatState.messageHistory.push({
    role: 'assistant',
    content: response
  });

  // Display agent's response
  displayChatMessage(state.chatState.currentAgent.name, response);
  
  // Prompt for the next message
  console.log('\nType your message or "exit" to end the conversation:');
  process.stdout.write('> ');
}

/**
 * Display the initial response from the agent at the start of a chat
 * @param {string} response - The agent's initial response
 */
function displayInitialResponse(response) {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🤖 ${state.chatState.currentAgent.name}:`);
  console.log(response);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nType your message or "exit" to end the conversation:');
  process.stdout.write('> ');
}

/**
 * Set up a direct response listener for chat messages
 */
function setupDirectResponseListener() {
  // Set up direct response listener to catch all potential responses
  state.chatState.directResponseListener = (message) => {
    if (!state.chatState.inChatSession) return;
    
    // Check if this could be a response to our chat tasks
    if (message.type === 'task.result' && 
        (message.content.taskId === state.chatState.currentTaskId || 
        message.content.taskId === state.chatState.initTaskId)) {
      
      console.log(`Direct listener caught task result for ${message.content.taskId}`);
      if (message.content.taskId === state.chatState.currentTaskId) {
        handleChatResponse(message.content);
      } else if (message.content.taskId === state.chatState.initTaskId) {
        // Handle initialization response
        if (message.content.result && message.content.result.response) {
          displayInitialResponse(message.content.result.response);
        }
      }
    }
  };
    
  // Add the direct listener for all messages
  state.client.on('message', state.chatState.directResponseListener);
}

/**
 * Start a chat session with an agent
 */
async function startChatSession() {
  try {
    // If no agents are loaded, get the list first
    if (state.agents.length === 0) {
      await listAgents();
    }
    
    if (state.agents.length === 0) {
      console.log('❌ No agents available for chat');
      return;
    }
    
    // Get online agents
    const onlineAgents = state.agents.filter(agent => agent.status === 'online');
    
    if (onlineAgents.length === 0) {
      console.log('❌ No online agents available for chat');
      return;
    }

    // Create agent choices for inquirer
    const agentChoices = onlineAgents.map(agent => ({
      name: `${agent.name} (${agent.capabilities.join(', ')})`,
      value: agent
    }));

    // Temporary pause readline to avoid conflicts with inquirer
    rl.pause();

    // Select an agent using inquirer
    const selectedAgent = await select({
      message: 'Select an agent to chat with:',
      choices: agentChoices
    });

    // Resume readline
    rl.resume();
    
    console.log(`\nStarting chat session with ${selectedAgent.name}...`);
    
    // Create a unique conversation ID
    const conversationId = uuidv4();
    
    // Update chat state
    state.chatState = {
      inChatSession: true,
      currentAgent: selectedAgent,
      conversationId: conversationId,
      messageHistory: [],
      initTaskId: null,
      currentTaskId: null,
      directResponseListener: null
    };
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log(`║ Chat session with ${selectedAgent.name}`);
    console.log('║ Type "exit" at any time to end the conversation');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    // Set up direct response listener
    setupDirectResponseListener();
    
    // Start the conversation with the agent
    try {
      console.log('\nInitializing conversation...');
      
      // Send a conversation:start task to initialize the chat
      const startTaskData = {
        taskType: 'conversation:start',
        conversationId: conversationId,
        context: {
          userData: {
            clientId: state.client.clientId,
            preferences: {
              formality: 'balanced',
              verbosity: 'balanced'
            }
          }
        }
      };
      
      // Add an event listener specifically for this task result
      let initTaskCompleted = false;
      const initTaskListener = (content) => {
        if (content.taskId && state.chatState.initTaskId === content.taskId) {
          initTaskCompleted = true;
          
          if (content.result && content.result.response) {
            // Add agent's greeting to message history
            state.chatState.messageHistory.push({
              role: 'assistant',
              content: content.result.response
            });
            
            // Display agent's greeting
            displayChatMessage(selectedAgent.name, content.result.response);
          }
        }
      };
      
      // Add the listener for task results
      state.client.on('task-result', initTaskListener);
      
      // Send the initialization task 
      try {
        const initResponse = await state.client.sendTask(selectedAgent.name, startTaskData, { waitForResult: false });
        state.chatState.initTaskId = initResponse.taskId;
        console.log(`Initialization task sent with ID: ${initResponse.taskId}`);
        
        // Wait up to 5 seconds for the initialization response
        let timeoutCount = 0;
        while (!initTaskCompleted && timeoutCount < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          timeoutCount++;
        }
        
        // Remove the listener once we're done with initialization
        state.client.removeListener('task-result', initTaskListener);
        
        if (!initTaskCompleted) {
          console.log("\nAgent didn't respond to initialization request, but we can still try to chat.");
          console.log("The agent may still be processing or might respond later.");
        }
      } catch (error) {
        console.error(`\n❌ Error sending initialization task: ${error.message}`);
        state.client.removeListener('task-result', initTaskListener);
      }
      
    } catch (error) {
      console.error(`\n❌ Error initializing conversation: ${error.message}`);
    }
    
    // Prompt for the first message
    console.log('\nType your message:');
    process.stdout.write('> ');
    
    // Create a temporary readline interface just for chat
    const chatRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Handle chat input
    chatRl.on('line', async (line) => {
      const message = line.trim();
      
      // Check if user wants to exit the chat
      if (message.toLowerCase() === 'exit') {
        await endChatSession(chatRl);
        return;
      }
      
      await sendChatMessage(message);
    });
    
    // Handle chat session cleanup when readline closes
    chatRl.on('close', () => {
      if (state.chatState.inChatSession) {
        // Remove direct response listener
        if (state.chatState.directResponseListener) {
          state.client.removeListener('message', state.chatState.directResponseListener);
        }
        
        state.chatState.inChatSession = false;
        console.log('\nChat session ended.');
        process.stdout.write('\n> ');
      }
    });
    
  } catch (error) {
    console.error('❌ Error starting chat session:', error.message);
    state.chatState.inChatSession = false;
  }
}

/**
 * Send a message within an existing chat session
 * @param {string} message - Message to send
 */
async function sendChatMessage(message) {
  // Add message to history
  state.chatState.messageHistory.push({
    role: 'user',
    content: message
  });
  
  // Prepare chat task data using the correct format for ConversationAgent
  const taskData = {
    taskType: 'conversation:message',
    conversationId: state.chatState.conversationId,
    message: message,
    context: {
      messageHistory: state.chatState.messageHistory
    }
  };
  
  try {
    // Send message to agent
    console.log('\nSending message to agent...');
    
    // Send the task using the SDK
    const response = await state.client.sendTask(state.chatState.currentAgent.name, taskData, { waitForResult: false });
    
    // Store current task ID for tracking responses
    state.chatState.currentTaskId = response.taskId;
    console.log(`Message sent with task ID: ${response.taskId}`);
    
  } catch (error) {
    console.error(`\n❌ Error sending message: ${error.message}`);
    console.log('\nType your message or "exit" to end the conversation:');
    process.stdout.write('> ');
  }
}

/**
 * End a chat session
 * @param {readline.Interface} chatRl - The readline interface to close
 */
async function endChatSession(chatRl) {
  console.log('\nEnding chat session...');
  
  // Send conversation:end message
  try {
    await state.client.sendTask(state.chatState.currentAgent.name, {
      taskType: 'conversation:end',
      conversationId: state.chatState.conversationId
    }, { waitForResult: false });
  } catch (error) {
    console.error(`\n❌ Error ending conversation: ${error.message}`);
  }
  
  // Remove direct response listener
  if (state.chatState.directResponseListener) {
    state.client.removeListener('message', state.chatState.directResponseListener);
  }
  
  state.chatState.inChatSession = false;
  chatRl.close();
  process.stdout.write('\n> ');
}

/**
 * List available agents
 * @returns {Promise<Array>} - Array of agents
 */
async function listAgents() {
  try {
    console.log('Fetching agent list...');
    const agents = await state.client.getAgents();
    state.agents = agents;
    return agents;
  } catch (error) {
    console.error('❌ Error fetching agents:', error.message);
    return [];
  }
}

module.exports = {
  startChatSession,
  handleChatResponse,
  displayInitialResponse,
  sendChatMessage,
  endChatSession,
  listAgents
}; 