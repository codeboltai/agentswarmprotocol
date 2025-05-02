/**
 * ConversationAgent class for Agent Swarm Protocol
 * Provides conversational capabilities with memory and context awareness
 */

const SwarmAgentSDK = require('../../sdk/agentsdk');
const { v4: uuidv4 } = require('uuid');

class ConversationAgent extends SwarmAgentSDK {
  constructor(config = {}) {
    // Set default name if not provided
    config.name = config.name || 'Conversation Agent';
    
    // Set capabilities
    config.capabilities = [
      'chat',
      'contextual-responses',
      'memory',
      'preference-adaptation'
    ];
    
    // Set description
    config.description = 'Conversational agent with memory and context awareness';
    
    // Call parent constructor with config
    super(config);

    // Set up logging
    this.logger = {
      info: (message) => console.log(`[INFO] ${message}`),
      warn: (message) => console.warn(`[WARN] ${message}`),
      error: (message) => console.error(`[ERROR] ${message}`)
    };

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
    this.registerTaskHandler('conversation:start', this.handleConversationStart.bind(this));
    this.registerTaskHandler('conversation:message', this.handleConversationMessage.bind(this));
    this.registerTaskHandler('conversation:end', this.handleConversationEnd.bind(this));
    
    // Add support for the simple 'chat' task type for backward compatibility
    this.registerTaskHandler('chat', this.handleChatTask.bind(this));
    
    // Register a default handler for unrecognized task types
    this.registerDefaultTaskHandler(this.handleDefaultOrConvertTask.bind(this));
  }

  /**
       * Handle conversation start task
       * @param {Object} task - The task object
       * @param {Object} metadata - Task metadata
       * @returns {Object} - Result with greeting and initialized context
       */
  async handleConversationStart(task, metadata) {
    this.logger.info(`Handling conversation:start task`);
    this.logger.info(`Task debug info: ${JSON.stringify({
      conversationId: task.conversationId,
      context: task.context,
      metadata: metadata
    })}`);
    
    const { conversationId = uuidv4(), context = {} } = task || {};
    
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
    
    const result = {
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
    
    this.logger.info(`Sending conversation:start response: ${JSON.stringify(result)}`);
    
    return result;
  }

  /**
 * Handle message in an ongoing conversation
 * @param {Object} task - The task object
 * @param {Object} metadata - Task metadata
 * @returns {Object} - Result with response and updated context
 */
  async handleConversationMessage(task, metadata) {
    this.logger.info(`Handling conversation:message task`);
    this.logger.info(`Task debug info: ${JSON.stringify({
      conversationId: task.conversationId,
      hasMessage: !!task.message,
      messageLength: task.message ? task.message.length : 0,
      metadata: metadata
    })}`);
    
    const { conversationId, message, context = {} } = task || {};
    
    if (!conversationId) {
      this.logger.error('Missing required field: conversationId');
      throw new Error('Missing required field: conversationId');
    }
    
    if (!message) {
      this.logger.error('Missing required field: message');
      throw new Error('Missing required field: message');
    }
    
    // Get or create conversation context
    if (!this.conversations.has(conversationId)) {
      this.logger.warn(`Conversation ${conversationId} not found, initializing`);
      await this.handleConversationStart({ conversationId, context });
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
            taskType: 'research:query',
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
    
    this.logger.info(`Sending conversation:message response for "${message}"`);
    this.logger.info(`Response debug info: ${JSON.stringify({
      responseType: typeof responseData, 
      hasResponse: !!responseData.response, 
      responseLength: responseData.response ? responseData.response.length : 0
    })}`);
    
    return responseData;
  }

  /**
 * Handle conversation end task
 * @param {Object} task - The task object
 * @param {Object} metadata - Task metadata
 * @returns {Object} - Result with conversation statistics
 */
  async handleConversationEnd(task, metadata) {
    const { conversationId } = task || {};
    
    if (!conversationId) {
      throw new Error('Missing required field: conversationId');
    }
    
    if (!this.conversations.has(conversationId)) {
      return {
        error: `Conversation ${conversationId} not found`
      };
    }
    
    const convoContext = this.conversations.get(conversationId);
    const endedAt = new Date().toISOString();
    const startedAt = new Date(convoContext.startedAt);
    const duration = new Date() - startedAt;
    
    // Generate farewell message
    const farewell = this.generateFarewell(conversationId, convoContext);
    
    // Create conversation summary
    const summary = {
      conversationId,
      startedAt: convoContext.startedAt,
      endedAt,
      duration: this.formatDuration(duration),
      messageCount: convoContext.messageCount,
      farewell
    };
    
    // Remove the conversation from active conversations
    this.conversations.delete(conversationId);
    
    this.logger.info(`Ended conversation ${conversationId} (duration: ${summary.duration})`);
    
    return summary;
  }

  /**
 * Handle simple chat task for backward compatibility
 * @param {Object} task - The task data
 * @param {Object} metadata - Task metadata
 * @returns {Promise<Object>} Task result
 */
  async handleChatTask(task, metadata) {
    this.logger.info('Received legacy chat task, converting to conversation:message format');
    
    const { message, conversationId = uuidv4(), messageHistory = [] } = task;
    
    if (!message) {
      throw new Error('Missing required field: message');
    }
    
    // Check if conversation exists, if not initialize it
    if (!this.conversations.has(conversationId)) {
      this.logger.info(`Initializing new conversation for legacy chat task: ${conversationId}`);
      await this.handleConversationStart({ 
        conversationId,
        context: {
          userData: {
            clientId: metadata.clientId || 'unknown',
            preferences: { formality: 'balanced', verbosity: 'balanced' }
          }
        }
      });
    }
    
    // Convert to conversation:message format and delegate
    return this.handleConversationMessage({
      conversationId,
      message,
      context: { messageHistory }
    }, metadata);
  }

  /**
   * Handle default tasks or try to convert to supported format
   * @param {Object} task - The task data
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} Task result
   */
  async handleDefaultOrConvertTask(task, metadata) {
    this.logger.warn(`Trying to determine task type from payload: ${JSON.stringify(task)}`);
    
    // Check if this is a conversation message task but the type is missing or in a different field
    if (task.taskType === 'conversation:message' || 
        (task.input && task.input.taskType === 'conversation:message') ||
        (task.message && task.conversationId)) {
      
      this.logger.info('Recognized conversation:message pattern, handling as conversation message');
      return this.handleConversationMessage(task, metadata);
    }
    
    // Otherwise fall back to the default handler
    return this.handleDefaultTask(task, metadata);
  }





  /**
   * Handle default tasks
   * @param {Object} task - The task data
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} Task result
   */
  async handleDefaultTask(task, metadata) {
    this.logger.warn(`Received unknown task type: ${task.taskType || 'undefined'}`);
    this.logger.warn(`Task debug info: ${JSON.stringify({
      taskType: task.taskType,
      input: task.input ? typeof task.input : 'undefined',
      conversationId: task.conversationId,
      hasMessage: !!task.message,
      metadata: metadata,
      fullTask: JSON.stringify(task)
    })}`);
    
    return {
      message: `Unsupported task type: ${task.taskType || 'undefined'}`,
      supportedTaskTypes: [
        'conversation:start',
        'conversation:message',
        'conversation:end'
      ]
    };
  }

  /**
   * Generate a greeting message based on context
   * @param {string} conversationId - Conversation ID
   * @param {Object} context - Conversation context
   * @returns {string} - Greeting message
   */
  generateGreeting(conversationId, context) {
    const timeOfDay = new Date().getHours();
    let greeting = '';
    
    if (timeOfDay < 12) greeting = 'Good morning';
    else if (timeOfDay < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';
    
    // Add user name if available
    if (context.userData && context.userData.name) {
      greeting += `, ${context.userData.name}`;
    }
    
    greeting += '! I\'m your conversation assistant. How can I help you today?';
    
    return greeting;
  }

  /**
   * Generate a farewell message based on context
   * @param {string} conversationId - Conversation ID
   * @param {Object} context - Conversation context
   * @returns {string} - Farewell message
   */
  generateFarewell(conversationId, context) {
    let farewell = 'Thank you for chatting with me';
    
    // Add user name if available
    if (context.userData && context.userData.name) {
      farewell += `, ${context.userData.name}`;
    }
    
    farewell += '. Have a great day!';
    
    if (context.messageCount > 10) {
      farewell += ' It was a pleasure having such an in-depth conversation with you.';
    }
    
    return farewell;
  }

  /**
   * Generate a response to a user message
   * @param {string} conversationId - Conversation ID
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @param {Array} intents - Detected intents
   * @param {string} sentiment - Detected sentiment
   * @param {Object} researchResult - Research results if available
   * @returns {Object} - Response data object
   */
  generateResponse(conversationId, message, context, intents, sentiment, researchResult = null) {
    // Initialize contextUpdates for tracking changes
    const contextUpdates = {};
    
    // Initialize response data
    const responseData = {
      conversationId,
      intents,
      sentiment,
      contextUpdates
    };
    
    let response = '';
    
    // Handle different intents
    if (intents.includes('greeting')) {
      response = this.generateGreeting(conversationId, context);
    }
    else if (intents.includes('farewell')) {
      response = this.generateFarewell(conversationId, context);
    }
    else if (intents.includes('help') || intents.includes('capabilities')) {
      response = this.generateCapabilitiesResponse(context);
    }
    else if (intents.includes('preference_change')) {
      response = this.handlePreferenceChange(message, context, contextUpdates);
    }
    else if (researchResult) {
      response = this.formatResearchResponse(researchResult, context);
    }
    else {
      // Generate a generic response
      response = this.generateGenericResponse(message, context);
    }
    
    // Adjust response based on user preferences
    if (context.preferences) {
      if (context.preferences.verbosity) {
        response = this.adjustResponseVerbosity(response, context.preferences.verbosity);
      }
    }
    
    responseData.response = response;
    
    // Add suggested actions based on conversation flow
    responseData.suggestedActions = this.generateSuggestedActions(message, context, intents);
    
    return responseData;
  }

  /**
   * Adjust response verbosity based on user preference
   * @param {string} response - Original response
   * @param {string} verbosity - Verbosity preference
   * @returns {string} - Adjusted response
   */
  adjustResponseVerbosity(response, verbosity) {
    if (verbosity === 'concise') {
      // Simplify response for concise preference
      return response.split('. ').slice(0, 1).join('. ');
    } 
    else if (verbosity === 'detailed') {
      // Add more details for detailed preference
      return response + ' Is there anything else you would like to know about this?';
    }
    
    // Return original for balanced verbosity
    return response;
  }

  /**
   * Generate a response about agent capabilities
   * @param {Object} context - Conversation context
   * @returns {string} - Capabilities response
   */
  generateCapabilitiesResponse(context) {
    return 'I am a conversational agent. I can chat with you, remember our conversation context, ' +
           'adapt to your preferences, and connect with research capabilities. ' +
           'You can ask me questions, request information, or just have a casual conversation. ' +
           'How can I assist you today?';
  }

  /**
   * Generate a help response
   * @param {Object} context - Conversation context
   * @returns {string} - Help response
   */
  generateHelpResponse(context) {
    return 'You can talk to me about various topics. If you have questions that require research, ' +
           'I can collaborate with a Research Agent to get you answers. ' +
           'You can also tell me your preferences for how verbose or formal you\'d like me to be. ' +
           'What would you like to talk about?';
  }

  /**
   * Handle a message about changing preferences
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @param {Object} contextUpdates - Updates to context
   * @returns {string} - Response
   */
  handlePreferenceChange(message, context, contextUpdates) {
    // Extract preferences from message
    if (message.toLowerCase().includes('concise') || message.toLowerCase().includes('shorter')) {
      context.preferences.verbosity = 'concise';
      contextUpdates.preferences = { verbosity: 'concise' };
      return 'I\'ll keep my responses more concise from now on.';
    } 
    else if (message.toLowerCase().includes('detailed') || message.toLowerCase().includes('longer')) {
      context.preferences.verbosity = 'detailed';
      contextUpdates.preferences = { verbosity: 'detailed' };
      return 'I\'ll provide more detailed responses from now on.';
    }
    else if (message.toLowerCase().includes('formal')) {
      context.preferences.formality = 'formal';
      contextUpdates.preferences = { formality: 'formal' };
      return 'I\'ll maintain a more formal tone in our conversation moving forward.';
    }
    else if (message.toLowerCase().includes('casual') || message.toLowerCase().includes('informal')) {
      context.preferences.formality = 'casual';
      contextUpdates.preferences = { formality: 'casual' };
      return 'I\'ll keep things casual from now on.';
    }
    
    return 'I\'m not sure which preference you want to change. You can ask for more concise or detailed responses, or request a more formal or casual tone.';
  }

  /**
   * Generate a generic response
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @returns {string} - Generic response
   */
  generateGenericResponse(message, context) {
    // In a real implementation, this would use an AI model
    // Here we'll just use some simple patterns
    
    if (message.endsWith('?')) {
      return 'That\'s an interesting question. In a real implementation, I would use an AI model to generate a thoughtful response based on our conversation history.';
    }
    
    const responses = [
      'I understand. Tell me more about that.',
      'That\'s interesting. How does that make you feel?',
      'I see. What else would you like to discuss?',
      'Thanks for sharing that with me. What would you like to talk about next?',
      'I appreciate your perspective. Is there anything else on your mind?'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Generate suggested actions based on conversation
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @param {Array} intents - Detected intents
   * @returns {Array} - Suggested actions
   */
  generateSuggestedActions(message, context, intents) {
    const suggestions = [];
    
    // Add different suggestions based on context
    if (context.messageCount <= 2) {
      suggestions.push({
        type: 'suggestion',
        label: 'What can you do?',
        value: 'tell_me_about_capabilities'
      });
    }
    
    if (intents.includes('research') || intents.includes('question')) {
      suggestions.push({
        type: 'suggestion',
        label: 'Find more information',
        value: 'research_this_topic'
      });
    }
    
    if (context.messageCount > 5) {
      suggestions.push({
        type: 'suggestion',
        label: 'End conversation',
        value: 'end_conversation'
      });
    }
    
    return suggestions;
  }

  /**
   * Detect intents from user message
   * @param {string} message - User message
   * @returns {Array} - Detected intents
   */
  detectIntents(message) {
    const intents = [];
    const lowerMessage = message.toLowerCase();
    
    // Simple rule-based intent detection
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.match(/^(hey|greetings).*/)) {
      intents.push('greeting');
    }
    
    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
      intents.push('farewell');
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      intents.push('help');
    }
    
    if (lowerMessage.includes('capabilities') || lowerMessage.includes('features')) {
      intents.push('capabilities');
    }
    
    if (lowerMessage.includes('prefer') || lowerMessage.includes('concise') || 
        lowerMessage.includes('detailed') || lowerMessage.includes('formal') || 
        lowerMessage.includes('casual')) {
      intents.push('preference_change');
    }
    
    if (lowerMessage.endsWith('?') || lowerMessage.includes('who') || 
        lowerMessage.includes('what') || lowerMessage.includes('where') || 
        lowerMessage.includes('when') || lowerMessage.includes('why') || 
        lowerMessage.includes('how')) {
      intents.push('question');
    }
    
    if (lowerMessage.includes('research') || lowerMessage.includes('find information') || 
        lowerMessage.includes('look up') || lowerMessage.includes('search for')) {
      intents.push('research');
    }
    
    return intents;
  }

  /**
   * Analyze sentiment from user message
   * @param {string} message - User message
   * @returns {string} - Detected sentiment
   */
  analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();
    
    // Simple rule-based sentiment analysis
    // In a real implementation, this would use an NLP model
    
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
      'happy', 'glad', 'pleased', 'love', 'like', 'enjoy', 'thanks', 'thank'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'poor', 'sad', 'unhappy',
      'disappointed', 'hate', 'dislike', 'annoyed', 'angry', 'upset', 'not'
    ];
    
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
   * Format duration in a human-readable format
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} - Formatted duration
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
   * Check if a message is a research query
   * @param {string} message - User message
   * @returns {boolean} - Whether the message is a research query
   */
  isResearchQuery(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check for explicit research indicators
    if (lowerMessage.includes('research') || 
        lowerMessage.includes('find information') ||
        lowerMessage.includes('look up') ||
        lowerMessage.includes('search for')) {
      return true;
    }
    
    // Check for question patterns that often require research
    if ((lowerMessage.includes('what is') || 
         lowerMessage.includes('who is') ||
         lowerMessage.includes('how does') ||
         lowerMessage.includes('why is')) &&
         lowerMessage.endsWith('?')) {
      return true;
    }
    
    return false;
  }

  /**
   * Format research response from a research agent
   * @param {Object} researchResult - Research results
   * @param {Object} context - Conversation context
   * @returns {string} - Formatted research response
   */
  formatResearchResponse(researchResult, context) {
    if (!researchResult || researchResult.error) {
      return "I tried to research that, but couldn't find any relevant information. " +
             "Would you like to try a different question?";
    }
    
    let response = "Here's what I found based on your query:\n\n";
    
    if (researchResult.summary) {
      response += researchResult.summary;
    } else if (researchResult.results && Array.isArray(researchResult.results)) {
      // Format results into a readable response
      researchResult.results.forEach((item, index) => {
        response += `${index + 1}. ${item.title || 'Result'}: ${item.snippet || item.description || 'No details available'}\n`;
      });
    } else if (researchResult.query && researchResult.sources) {
      // Format source-based research results
      response += `Query: "${researchResult.query}"\n\n`;
      
      researchResult.sources.forEach(source => {
        response += `From ${source.source} (${source.resultCount} results):\n`;
        
        if (source.results && Array.isArray(source.results)) {
          source.results.forEach((result, index) => {
            response += `${index + 1}. ${result.title}: ${result.snippet}\n`;
          });
        }
        
        response += '\n';
      });
    } else {
      // Generic fallback if the format is unknown
      response += JSON.stringify(researchResult);
    }
    
    return response;
  }


}

module.exports = ConversationAgent; 