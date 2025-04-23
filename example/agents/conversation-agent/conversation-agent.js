/**
 * ConversationAgent class for Agent Swarm Protocol
 * Provides conversational capabilities with memory and context awareness
 */

const { Agent } = require('../../../sdk/nodejs/agent');
const { v4: uuidv4 } = require('uuid');

class ConversationAgent extends Agent {
  constructor(config = {}) {
    super({
      ...config,
      capabilities: [
        'chat',
        'contextual-responses',
        'memory',
        'preference-adaptation'
      ]
    });

    // Store active conversations with their contexts
    this.conversations = new Map();
    
    // Register task handlers
    this.registerTaskHandlers();
    
    this.logger.info('ConversationAgent initialized');
  }

  /**
   * Register handlers for different task types
   */
  registerTaskHandlers() {
    this.registerTaskHandler('conversation.start', this.handleConversationStart.bind(this));
    this.registerTaskHandler('conversation.message', this.handleConversationMessage.bind(this));
    this.registerTaskHandler('conversation.end', this.handleConversationEnd.bind(this));
  }

  /**
   * Handle conversation start task
   * @param {Object} task - The task object
   * @returns {Object} - Result with greeting and initialized context
   */
  async handleConversationStart(task) {
    const { conversationId = uuidv4(), context = {} } = task.taskData || {};
    
    if (this.conversations.has(conversationId)) {
      this.logger.warn(`Conversation ${conversationId} already exists, reinitializing`);
    }
    
    // Initialize the conversation context
    const convoContext = {
      startedAt: new Date().toISOString(),
      messageCount: 0,
      history: [],
      userData: context.userData || {},
      preferences: {
        formality: (context.userData?.preferences?.formality) || 'balanced',
        verbosity: (context.userData?.preferences?.verbosity) || 'balanced'
      }
    };
    
    // Store the conversation
    this.conversations.set(conversationId, convoContext);
    
    this.logger.info(`Started conversation ${conversationId}`);
    
    // Generate greeting based on context
    const greeting = this.generateGreeting(conversationId, convoContext);
    
    return {
      conversationId,
      response: greeting,
      sentiment: 'positive',
      intents: ['greeting'],
      suggestedActions: [
        {
          type: 'suggestion',
          label: 'Tell me more about what you can do',
          value: 'tell_me_about_capabilities'
        }
      ],
      contextUpdates: {}
    };
  }

  /**
   * Handle message in an ongoing conversation
   * @param {Object} task - The task object
   * @returns {Object} - Result with response and updated context
   */
  async handleConversationMessage(task) {
    const { conversationId, message, context = {} } = task.data || {};
    
    if (!conversationId) {
      throw new Error('Missing required field: conversationId');
    }
    
    if (!message) {
      throw new Error('Missing required field: message');
    }
    
    // Get or create conversation context
    if (!this.conversations.has(conversationId)) {
      this.logger.warn(`Conversation ${conversationId} not found, initializing`);
      await this.handleConversationStart({ taskData: { conversationId, context } });
    }
    
    const convoContext = this.conversations.get(conversationId);
    
    // Update userData if provided
    if (context.userData) {
      convoContext.userData = {
        ...convoContext.userData,
        ...context.userData
      };
      
      // Update preferences if provided
      if (context.userData.preferences) {
        convoContext.preferences = {
          ...convoContext.preferences,
          ...context.userData.preferences
        };
      }
    }
    
    // Update message count and history
    convoContext.messageCount++;
    convoContext.history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Process the message
    const intents = this.detectIntents(message);
    const sentiment = this.analyzeSentiment(message);
    
    // Check if this is a research-related query and available agents are provided
    const isResearchQuery = this.isResearchQuery(message);
    let researchResult = null;
    
    if (isResearchQuery && context.availableAgents) {
      const researchAgent = context.availableAgents.find(agent => 
        agent.name === 'Research Agent' || 
        (agent.capabilities && agent.capabilities.includes('research'))
      );
      
      if (researchAgent) {
        this.logger.info(`Detected research query. Forwarding to Research Agent: ${researchAgent.name}`);
        
        try {
          // Use agent-to-agent communication to request research
          researchResult = await this.requestAgentTask(researchAgent.name, {
            taskType: 'research.query',
            query: message,
            context: {
              conversationId,
              originAgent: 'Conversation Agent'
            }
          });
          
          this.logger.info(`Received research result for query: "${message}"`);
        } catch (error) {
          this.logger.error(`Error requesting research: ${error.message}`);
        }
      }
    }
    
    // Generate a response (with research results if available)
    const responseData = this.generateResponse(
      conversationId, 
      message, 
      convoContext, 
      intents, 
      sentiment,
      researchResult
    );
    
    // Store agent's response in history
    convoContext.history.push({
      role: 'agent',
      content: responseData.response,
      timestamp: new Date().toISOString()
    });
    
    // Update conversation context
    this.conversations.set(conversationId, convoContext);
    
    return responseData;
  }

  /**
   * Handle conversation end task
   * @param {Object} task - The task object
   * @returns {Object} - Result with conversation statistics
   */
  async handleConversationEnd(task) {
    const { conversationId } = task.taskData || {};
    
    if (!conversationId) {
      throw new Error('Missing required field: conversationId');
    }
    
    if (!this.conversations.has(conversationId)) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    const convoContext = this.conversations.get(conversationId);
    const endedAt = new Date().toISOString();
    const duration = new Date(endedAt) - new Date(convoContext.startedAt);
    
    // Calculate conversation statistics
    const stats = {
      startedAt: convoContext.startedAt,
      endedAt,
      durationMs: duration,
      durationHuman: this.formatDuration(duration),
      messageCount: convoContext.messageCount,
      averageResponseTime: '~1 second' // Placeholder, would calculate from actual response times
    };
    
    // Generate farewell message
    const farewell = this.generateFarewell(conversationId, convoContext);
    
    // Remove the conversation from memory
    this.conversations.delete(conversationId);
    
    this.logger.info(`Ended conversation ${conversationId}`);
    
    return {
      conversationId,
      response: farewell,
      sentiment: 'neutral',
      stats
    };
  }

  /**
   * Generate a greeting based on user context
   * @param {string} conversationId - Conversation identifier
   * @param {Object} context - Conversation context
   * @returns {string} - Personalized greeting
   */
  generateGreeting(conversationId, context) {
    const { userData } = context;
    const name = userData.name ? `, ${userData.name}` : '';
    
    // Adjust formality based on preferences
    if (context.preferences.formality === 'casual') {
      return `Hey${name}! How can I help you today?`;
    } else if (context.preferences.formality === 'formal') {
      return `Hello${name}. How may I assist you today?`;
    } else {
      return `Hi${name}! How can I assist you today?`;
    }
  }

  /**
   * Generate a farewell based on conversation context
   * @param {string} conversationId - Conversation identifier
   * @param {Object} context - Conversation context
   * @returns {string} - Personalized farewell
   */
  generateFarewell(conversationId, context) {
    const { userData, messageCount } = context;
    const name = userData.name ? `, ${userData.name}` : '';
    
    // Adjust message based on conversation length
    let messageSuffix = '.';
    if (messageCount > 10) {
      messageSuffix = '. It was a pleasure having this extended conversation with you.';
    } else if (messageCount > 5) {
      messageSuffix = '. I enjoyed our conversation.';
    }
    
    // Adjust formality based on preferences
    if (context.preferences.formality === 'casual') {
      return `See you later${name}${messageSuffix}`;
    } else if (context.preferences.formality === 'formal') {
      return `Goodbye${name}. Thank you for the conversation${messageSuffix}`;
    } else {
      return `Goodbye${name}${messageSuffix} Have a great day!`;
    }
  }

  /**
   * Generate a response based on message and context
   * @param {string} conversationId - Conversation identifier
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @param {Array} intents - Detected intents
   * @param {string} sentiment - Detected sentiment
   * @param {Object} researchResult - Optional research results
   * @returns {Object} - Response object
   */
  generateResponse(conversationId, message, context, intents, sentiment, researchResult = null) {
    let response = '';
    let suggestedActions = [];
    const contextUpdates = {};
    
    // Handle different intents
    if (intents.includes('greeting')) {
      response = this.generateGreeting(conversationId, context);
    } else if (intents.includes('farewell')) {
      response = this.generateFarewell(conversationId, context);
    } else if (intents.includes('capabilities')) {
      response = this.generateCapabilitiesResponse(context);
      suggestedActions = [
        { type: 'suggestion', label: 'Adjust verbosity', value: 'adjust_verbosity' },
        { type: 'suggestion', label: 'Adjust formality', value: 'adjust_formality' }
      ];
    } else if (intents.includes('preference_change')) {
      response = this.handlePreferenceChange(message, context, contextUpdates);
    } else if (intents.includes('help')) {
      response = this.generateHelpResponse(context);
      suggestedActions = [
        { type: 'suggestion', label: 'Tell me about your capabilities', value: 'tell_me_about_capabilities' }
      ];
    } else if (researchResult) {
      // Use research results if available
      response = this.formatResearchResponse(researchResult, context);
      
      // Add suggested follow-up questions if provided by research agent
      if (researchResult.suggestedQuestions && researchResult.suggestedQuestions.length > 0) {
        researchResult.suggestedQuestions.forEach(question => {
          suggestedActions.push({
            type: 'suggestion',
            label: question,
            value: question
          });
        });
      }
    } else {
      // Default response for other messages
      response = this.generateGenericResponse(message, context);
      
      // Add suggested actions based on message content
      if (message.length > 100) {
        suggestedActions.push({
          type: 'suggestion',
          label: 'Give me a shorter response next time',
          value: 'set_preference_verbosity_concise'
        });
      }
    }
    
    // Adjust response based on verbosity preference
    response = this.adjustResponseVerbosity(response, context.preferences.verbosity);
    
    return {
      conversationId,
      response,
      sentiment,
      intents,
      suggestedActions,
      contextUpdates
    };
  }

  /**
   * Adjust response verbosity based on user preference
   * @param {string} response - Original response
   * @param {string} verbosity - Verbosity preference
   * @returns {string} - Adjusted response
   */
  adjustResponseVerbosity(response, verbosity) {
    switch (verbosity) {
      case 'concise':
        // Shorten the response
        return response.split('. ')[0] + '.';
      case 'detailed':
        // Add more details
        return response + ' Is there anything specific you would like me to elaborate on?';
      case 'balanced':
      default:
        return response;
    }
  }

  /**
   * Generate response about agent capabilities
   * @param {Object} context - Conversation context
   * @returns {string} - Capabilities description
   */
  generateCapabilitiesResponse(context) {
    // Adjust based on verbosity preference
    if (context.preferences.verbosity === 'concise') {
      return "I can chat, remember our conversation, and adapt to your preferences.";
    } else if (context.preferences.verbosity === 'detailed') {
      return "I'm a conversation agent with several capabilities. I can engage in natural language conversations, remember our conversation history for context, adapt my responses based on your preferences for formality and verbosity, and suggest relevant actions based on our conversation. I can also handle different conversation styles and topics.";
    } else {
      return "I'm a conversation agent that can chat with you, remember our conversation history, and adapt to your preferences for formality and verbosity. I can also suggest relevant actions based on our conversation.";
    }
  }

  /**
   * Generate help response
   * @param {Object} context - Conversation context
   * @returns {string} - Help information
   */
  generateHelpResponse(context) {
    return "I'm here to chat with you. You can ask me about my capabilities, change your preferences for how I respond (like being more formal/casual or more detailed/concise), or just have a conversation. What would you like to do?";
  }

  /**
   * Handle preference change intent
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @param {Object} contextUpdates - Context updates to apply
   * @returns {string} - Response confirming preference change
   */
  handlePreferenceChange(message, context, contextUpdates) {
    // Check for verbosity change
    if (message.toLowerCase().includes('concise') || message.toLowerCase().includes('shorter')) {
      contextUpdates.preferences = { ...contextUpdates.preferences, verbosity: 'concise' };
      return "I'll keep my responses more concise from now on.";
    } else if (message.toLowerCase().includes('detailed') || message.toLowerCase().includes('longer')) {
      contextUpdates.preferences = { ...contextUpdates.preferences, verbosity: 'detailed' };
      return "I'll provide more detailed responses from now on.";
    } 
    
    // Check for formality change
    if (message.toLowerCase().includes('formal')) {
      contextUpdates.preferences = { ...contextUpdates.preferences, formality: 'formal' };
      return "I'll maintain a more formal tone going forward.";
    } else if (message.toLowerCase().includes('casual') || message.toLowerCase().includes('informal')) {
      contextUpdates.preferences = { ...contextUpdates.preferences, formality: 'casual' };
      return "I'll keep things casual from now on.";
    }
    
    return "I'm not sure which preference you'd like to change. You can adjust my verbosity (concise/detailed) or formality (formal/casual).";
  }

  /**
   * Generate a generic response
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @returns {string} - Generic response
   */
  generateGenericResponse(message, context) {
    // This would typically use NLP/LLM to generate contextual responses
    // Here we're using simple patterns for demonstration
    
    const lowercaseMessage = message.toLowerCase();
    
    if (lowercaseMessage.includes('thank')) {
      return context.preferences.formality === 'formal' 
        ? "You're most welcome. Is there anything else I can assist you with?"
        : "You're welcome! Anything else you need?";
    }
    
    if (lowercaseMessage.includes('?')) {
      return "That's an interesting question. In a real implementation, I would use a language model to generate a proper response based on our conversation history.";
    }
    
    if (context.messageCount === 1) {
      return "Thank you for your message. How can I assist you further today?";
    }
    
    // Default fallback response
    const responses = [
      "I understand. What else would you like to discuss?",
      "That's interesting. Tell me more.",
      "I see. How else can I help you today?",
      "Got it. Is there something specific you'd like to know?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Simple intent detection function
   * @param {string} message - User message
   * @returns {Array} - Array of detected intents
   */
  detectIntents(message) {
    const intents = [];
    const lowerMessage = message.toLowerCase();
    
    // Simple rule-based intent detection
    if (/^(hi|hello|hey|greetings)/i.test(lowerMessage)) {
      intents.push('greeting');
    }
    
    if (/^(bye|goodbye|farewell|see you)/i.test(lowerMessage)) {
      intents.push('farewell');
    }
    
    if (/what can you do|capabilities|features|what are you able to/i.test(lowerMessage)) {
      intents.push('capabilities');
    }
    
    if (/help( me)?|assist( me)?|how do I/i.test(lowerMessage)) {
      intents.push('help');
    }
    
    if (/prefer|settings|adjust|change|set|make (responses|it) (shorter|longer|more detailed|more concise|formal|informal|casual)/i.test(lowerMessage)) {
      intents.push('preference_change');
    }
    
    if (intents.length === 0) {
      intents.push('general');
    }
    
    return intents;
  }

  /**
   * Simple sentiment analysis function
   * @param {string} message - User message
   * @returns {string} - Detected sentiment
   */
  analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();
    
    // Simple keyword-based sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'thanks', 'thank you', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'sad', 'angry', 'upset', 'hate', 'dislike'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
      if (lowerMessage.includes(word)) {
        positiveScore++;
      }
    });
    
    negativeWords.forEach(word => {
      if (lowerMessage.includes(word)) {
        negativeScore++;
      }
    });
    
    if (positiveScore > negativeScore) {
      return 'positive';
    } else if (negativeScore > positiveScore) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  /**
   * Format duration in milliseconds to human-readable string
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} - Formatted duration string
   */
  formatDuration(durationMs) {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Check if a message is a research-related query
   * @param {string} message - User message
   * @returns {boolean} - True if the message is a research query
   */
  isResearchQuery(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check for research-related keywords and question patterns
    const researchKeywords = [
      'research', 'find', 'search', 'look up', 'information', 
      'data', 'article', 'paper', 'study', 'report',
      'what is', 'who is', 'when did', 'where is', 'why does',
      'how does', 'tell me about'
    ];
    
    return researchKeywords.some(keyword => lowerMessage.includes(keyword)) &&
           (lowerMessage.includes('?') || 
            lowerMessage.startsWith('find') || 
            lowerMessage.startsWith('search') ||
            lowerMessage.startsWith('research'));
  }

  /**
   * Format a response that includes research results
   * @param {Object} researchResult - Results from research agent
   * @param {Object} context - Conversation context
   * @returns {string} - Formatted response with research information
   */
  formatResearchResponse(researchResult, context) {
    const formality = context.preferences.formality;
    const verbosity = context.preferences.verbosity;
    
    let intro;
    if (formality === 'formal') {
      intro = "Based on my research, I've found the following information: ";
    } else if (formality === 'casual') {
      intro = "Hey, I looked that up and found this: ";
    } else {
      intro = "I found some information for you: ";
    }
    
    // Extract the main content from research results
    let content = '';
    if (typeof researchResult === 'string') {
      content = researchResult;
    } else if (researchResult.answer) {
      content = researchResult.answer;
    } else if (researchResult.content) {
      content = researchResult.content;
    } else if (researchResult.results) {
      // Format research results as a list if appropriate
      content = Array.isArray(researchResult.results)
        ? researchResult.results.map((item, i) => `${i+1}. ${item}`).join('\n')
        : researchResult.results;
    }
    
    // Add source information if available
    let sources = '';
    if (researchResult.sources && researchResult.sources.length > 0) {
      if (verbosity !== 'concise') {
        sources = "\n\nSources:\n" + researchResult.sources
          .slice(0, verbosity === 'detailed' ? 5 : 2)
          .map(source => `- ${source.title || source.url}`)
          .join('\n');
      }
    }
    
    return intro + content + sources;
  }
}

module.exports = { ConversationAgent }; 