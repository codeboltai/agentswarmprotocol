/**
 * Conversation Agent - An agent that can hold conversations with users
 * This agent handles natural language interactions and maintains context.
 */

const SwarmAgentSDK = require('../../sdk/agentsdk/SwarmAgentSDK');

class ConversationAgent extends SwarmAgentSDK {
  constructor(config = {}) {
    super({
      ...config,
      agentType: 'conversation',
      capabilities: ['chat', 'contextual-responses', 'memory'],
      description: 'An agent that can hold conversations with users, maintaining context and providing natural responses'
    });

    // Initialize conversation state
    this.conversations = new Map();
    
    // Register task handlers
    this.registerTaskHandler('conversation.start', this.handleConversationStart);
    this.registerTaskHandler('conversation.message', this.handleConversationMessage);
    this.registerTaskHandler('conversation.end', this.handleConversationEnd);
    this.registerTaskHandler('default', this.handleUnknownTask);
    
    // Bind methods
    this.handleConversationStart = this.handleConversationStart.bind(this);
    this.handleConversationMessage = this.handleConversationMessage.bind(this);
    this.handleConversationEnd = this.handleConversationEnd.bind(this);
    this.handleUnknownTask = this.handleUnknownTask.bind(this);
    this.getConversationContext = this.getConversationContext.bind(this);
    this.updateConversationContext = this.updateConversationContext.bind(this);
  }

  /**
   * Handle the start of a new conversation
   * @param {Object} task The conversation start task
   * @returns {Object} The result of processing the task
   */
  async handleConversationStart(task) {
    const { conversationId, context = {} } = task.data || {};
    
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    // Initialize conversation with provided context
    this.conversations.set(conversationId, {
      id: conversationId,
      startTime: new Date().toISOString(),
      messages: [],
      context: context || {},
      active: true
    });
    
    return {
      conversationId,
      status: 'started',
      message: 'Conversation initiated successfully',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle a message in an existing conversation
   * @param {Object} task The conversation message task
   * @returns {Object} The result of processing the task
   */
  async handleConversationMessage(task) {
    const { conversationId, message, context = {} } = task.data || {};
    
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    if (!message) {
      throw new Error('Message content is required');
    }
    
    // Get or create conversation context
    const conversationContext = this.getConversationContext(conversationId);
    
    // Update context with any new information
    this.updateConversationContext(conversationId, context);
    
    // Add message to history
    conversationContext.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Process the message and generate a response
    const response = await this.generateResponse(message, conversationContext);
    
    // Add response to history
    conversationContext.messages.push({
      role: 'agent',
      content: response.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      conversationId,
      message: response.message,
      suggestedActions: response.suggestedActions || [],
      context: response.context || {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate a response to a user message
   * @param {string} message The user's message
   * @param {Object} context The conversation context
   * @returns {Object} The generated response
   */
  async generateResponse(message, context) {
    // This is where you would implement the logic to generate responses
    // For now, we'll return a simple echo response
    const userName = context.context.userName || 'User';
    const formality = context.context.preferences?.formality || 'neutral';
    const verbosity = context.context.preferences?.verbosity || 'moderate';
    
    let response = { message: '', suggestedActions: [], context: {} };
    
    // Simple response logic based on message content
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      response.message = this.formatGreeting(userName, formality);
    } else if (message.toLowerCase().includes('how are you')) {
      response.message = this.formatStatusResponse(formality);
    } else if (message.toLowerCase().includes('help')) {
      response.message = this.formatHelpResponse(verbosity);
      response.suggestedActions = [
        { type: 'text', value: 'Tell me about yourself' },
        { type: 'text', value: 'What can you do?' }
      ];
    } else if (message.toLowerCase().includes('goodbye') || message.toLowerCase().includes('bye')) {
      response.message = this.formatFarewell(userName, formality);
    } else {
      // Default response
      response.message = `I processed your message: "${message}". ${this.getRandomResponse(formality, verbosity)}`;
    }
    
    return response;
  }

  /**
   * Format a greeting based on user preferences
   * @param {string} userName User's name
   * @param {string} formality Formality level (formal, neutral, casual)
   * @returns {string} Formatted greeting
   */
  formatGreeting(userName, formality) {
    switch (formality) {
      case 'formal':
        return `Greetings, ${userName}. How may I assist you today?`;
      case 'casual':
        return `Hey ${userName}! What's up?`;
      case 'neutral':
      default:
        return `Hello ${userName}! How can I help you today?`;
    }
  }

  /**
   * Format a status response based on formality
   * @param {string} formality Formality level
   * @returns {string} Formatted response
   */
  formatStatusResponse(formality) {
    switch (formality) {
      case 'formal':
        return 'I am functioning optimally. Thank you for your inquiry.';
      case 'casual':
        return "I'm doing great! Thanks for asking! How about you?";
      case 'neutral':
      default:
        return "I'm well, thank you for asking. How can I help you today?";
    }
  }

  /**
   * Format a help response based on verbosity
   * @param {string} verbosity Verbosity level (concise, moderate, detailed)
   * @returns {string} Formatted help response
   */
  formatHelpResponse(verbosity) {
    switch (verbosity) {
      case 'concise':
        return "I'm a conversation agent. I can chat and remember context.";
      case 'detailed':
        return "I am a conversation agent designed to engage in natural dialogues while maintaining context throughout our interaction. I can remember details from earlier in our conversation, adapt my tone based on your preferences, and provide informative responses. You can ask me questions, request information, or just have a friendly chat. I can also suggest actions based on our conversation.";
      case 'moderate':
      default:
        return "I'm a conversation agent that can chat with you while maintaining context. I can remember details you share and adjust my responses based on your preferences. Feel free to ask me questions or just chat!";
    }
  }

  /**
   * Format a farewell based on user preferences
   * @param {string} userName User's name
   * @param {string} formality Formality level
   * @returns {string} Formatted farewell
   */
  formatFarewell(userName, formality) {
    switch (formality) {
      case 'formal':
        return `Farewell, ${userName}. It has been a pleasure assisting you.`;
      case 'casual':
        return `Later, ${userName}! Chat with you again soon!`;
      case 'neutral':
      default:
        return `Goodbye, ${userName}. Have a great day!`;
    }
  }

  /**
   * Get a random response based on user preferences
   * @param {string} formality Formality level
   * @param {string} verbosity Verbosity level
   * @returns {string} Random response
   */
  getRandomResponse(formality, verbosity) {
    const responses = {
      formal: {
        concise: [
          "I understand.",
          "Acknowledged.",
          "I shall consider this."
        ],
        moderate: [
          "I understand your message and will process accordingly.",
          "Thank you for sharing that information. Is there anything else you would like to discuss?",
          "I appreciate your input. Would you care to elaborate further?"
        ],
        detailed: [
          "I thoroughly understand the content of your message and will take it into consideration for our ongoing conversation. Would you be willing to provide additional context to help me better assist you?",
          "Thank you for sharing that information with me. I have incorporated it into our conversation context, which will enable me to provide more relevant assistance. Is there a particular aspect of this topic you would like to explore in more depth?",
          "I appreciate your detailed communication. To ensure I am addressing your needs appropriately, could you kindly clarify your primary objective in this conversation?"
        ]
      },
      casual: {
        concise: [
          "Got it!",
          "Cool!",
          "Nice one!"
        ],
        moderate: [
          "Got it! Thanks for letting me know.",
          "Cool! What else is on your mind?",
          "Nice! Anything else you want to chat about?"
        ],
        detailed: [
          "Got it! Thanks for sharing that with me. I'm always interested in learning more about what you're thinking, so feel free to go into more detail if you want!",
          "Cool stuff! I'm really enjoying our conversation. What other things have been on your mind lately that you'd like to talk about?",
          "Nice one! I appreciate you taking the time to chat with me. Is there anything specific you'd like my thoughts on, or shall we just keep the conversation flowing?"
        ]
      },
      neutral: {
        concise: [
          "I understand.",
          "Got it.",
          "Thanks for sharing."
        ],
        moderate: [
          "I understand. Is there anything else you'd like to discuss?",
          "Got it. How can I help you with this?",
          "Thanks for sharing that. What would you like to know?"
        ],
        detailed: [
          "I understand what you're saying. This information helps me provide better responses tailored to your needs. Is there a specific aspect of this topic you'd like me to address or explain further?",
          "Got it. I appreciate you providing this information. To make sure I'm on the right track, could you let me know what you're hoping to achieve in our conversation today?",
          "Thanks for sharing that with me. I find it helpful to understand your perspective. Would you like to explore this topic in more depth, or is there something else you'd prefer to discuss?"
        ]
      }
    };
    
    // Default to neutral and moderate if preferences not found
    const formalityLevel = responses[formality] || responses.neutral;
    const verbosityLevel = formalityLevel[verbosity] || formalityLevel.moderate;
    
    // Return a random response from the appropriate category
    return verbosityLevel[Math.floor(Math.random() * verbosityLevel.length)];
  }

  /**
   * Handle the end of a conversation
   * @param {Object} task The conversation end task
   * @returns {Object} The result of processing the task
   */
  async handleConversationEnd(task) {
    const { conversationId } = task.data || {};
    
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }
    
    // Mark conversation as inactive
    conversation.active = false;
    conversation.endTime = new Date().toISOString();
    
    // In a real implementation, you might persist the conversation to a database here
    
    return {
      conversationId,
      status: 'ended',
      message: 'Conversation ended successfully',
      statistics: {
        duration: new Date(conversation.endTime) - new Date(conversation.startTime),
        messageCount: conversation.messages.length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle an unknown task type
   * @param {Object} task The unknown task
   * @returns {Object} Error result
   */
  async handleUnknownTask(task) {
    return {
      error: `Unknown task type: ${task.taskType}`,
      supportedTypes: ['conversation.start', 'conversation.message', 'conversation.end'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get the context for a conversation
   * @param {string} conversationId The conversation ID
   * @returns {Object} The conversation context
   */
  getConversationContext(conversationId) {
    let conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      // Initialize a new conversation if it doesn't exist
      conversation = {
        id: conversationId,
        startTime: new Date().toISOString(),
        messages: [],
        context: {},
        active: true
      };
      this.conversations.set(conversationId, conversation);
    }
    
    return conversation;
  }

  /**
   * Update the context for a conversation
   * @param {string} conversationId The conversation ID
   * @param {Object} context New context data
   */
  updateConversationContext(conversationId, context) {
    const conversation = this.getConversationContext(conversationId);
    
    // Merge new context with existing context
    conversation.context = {
      ...conversation.context,
      ...context
    };
    
    // Update the conversation in the map
    this.conversations.set(conversationId, conversation);
  }
}

module.exports = ConversationAgent;

/**
 * Entry point for the Conversation Agent
 * Initializes and starts the agent
 */

const { ConversationAgent } = require('./conversation-agent');
require('dotenv').config();

// Initialize the agent with configuration
const agent = new ConversationAgent({
  // Agent identity
  name: process.env.AGENT_NAME || 'Conversation Agent',
  description: process.env.AGENT_DESCRIPTION || 'An agent that handles natural conversations with contextual memory',
  
  // Connection settings
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
  
  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info'
});

// Start the agent
agent.start()
  .then(() => {
    console.log(`Conversation Agent started and connected to ${agent.orchestratorUrl}`);
    console.log('Registered task handlers:');
    console.log('- conversation.start: Start a new conversation');
    console.log('- conversation.message: Send a message in an existing conversation');
    console.log('- conversation.end: End an existing conversation');
  })
  .catch(error => {
    console.error('Failed to start Conversation Agent:', error);
    process.exit(1);
  });

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down Conversation Agent...');
  await agent.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down Conversation Agent...');
  await agent.stop();
  process.exit(0);
}); 