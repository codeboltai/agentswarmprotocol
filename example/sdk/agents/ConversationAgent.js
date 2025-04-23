const SwarmAgentSDK = require('../SwarmAgentSDK');

/**
 * ConversationAgent - Agent for handling user conversations and interactions
 */
class ConversationAgent extends SwarmAgentSDK {
  /**
   * Create a new ConversationAgent
   * @param {Object} config - Agent configuration
   */
  constructor(config = {}) {
    super({
      name: config.name || 'conversation-agent',
      capabilities: ['conversation', 'chat', 'user-interaction'],
      orchestratorUrl: config.orchestratorUrl,
      manifest: {
        description: 'An agent that handles conversations and chat interactions with users',
        version: '1.0.0',
        requiredServices: ['llm-service']
      },
      ...config
    });
    
    this.defaultModel = config.defaultModel || process.env.DEFAULT_MODEL || 'gpt-4';
    this.messageHistory = [];
    
    // Register task handler
    this.on('task', this.handleTask.bind(this));
  }

  /**
   * Handle incoming tasks
   * @param {Object} message - Task message
   */
  async handleTask(message) {
    if (message.type === 'task.conversation') {
      await this.handleConversationTask(message);
    }
  }

  /**
   * Handle a conversation task
   * @param {Object} message - Conversation task message
   */
  async handleConversationTask(message) {
    const { input, metadata } = message.content;
    const { workflowExecution } = metadata || {};
    
    console.log(`Handling conversation: ${input.message}`);
    
    // Store message in history
    this.messageHistory.push({
      role: 'user',
      content: input.message
    });
    
    // Process the message using LLM service
    try {
      const llmResponse = await this.callLlmService(input.message);
      
      // Store response in history
      this.messageHistory.push({
        role: 'assistant',
        content: llmResponse
      });
      
      // Send response back to orchestrator
      this.sendTaskResult(message.id, llmResponse, { workflowExecution });
    } catch (error) {
      console.error('Error processing conversation:', error);
      this.sendTaskError(message.id, error, { workflowExecution });
    }
  }

  /**
   * Call the LLM service to process a message
   * @param {string} message - User message to process
   * @returns {Promise<string>} - LLM response
   */
  async callLlmService(message) {
    try {
      const response = await this.requestService('llm-service', {
        messages: this.messageHistory,
        model: this.defaultModel
      }, { timeout: 60000 });
      
      return response.text;
    } catch (error) {
      console.error('Error calling LLM service:', error);
      throw error;
    }
  }

  /**
   * Clear the message history
   */
  clearHistory() {
    this.messageHistory = [];
  }
}

module.exports = ConversationAgent; 