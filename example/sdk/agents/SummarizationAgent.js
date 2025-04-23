const SwarmAgentSDK = require('../SwarmAgentSDK');

/**
 * SummarizationAgent - Agent for summarizing content and extracting key points
 */
class SummarizationAgent extends SwarmAgentSDK {
  /**
   * Create a new SummarizationAgent
   * @param {Object} config - Agent configuration
   */
  constructor(config = {}) {
    super({
      name: config.name || 'summarization-agent',
      capabilities: ['summarization', 'content-processing', 'text-analysis'],
      orchestratorUrl: config.orchestratorUrl,
      manifest: {
        description: 'An agent that summarizes content and extracts key information',
        version: '1.0.0',
        requiredServices: ['llm-service']
      },
      ...config
    });
    
    this.defaultModel = config.defaultModel || process.env.DEFAULT_MODEL || 'gpt-4';
    
    // Register task handler
    this.on('task', this.handleTask.bind(this));
  }

  /**
   * Handle incoming tasks
   * @param {Object} message - Task message
   */
  async handleTask(message) {
    if (message.type === 'task.summarize') {
      await this.handleSummarizeTask(message);
    }
  }

  /**
   * Handle a summarization task
   * @param {Object} message - Summarization task message
   */
  async handleSummarizeTask(message) {
    const { input, metadata } = message.content;
    const { workflowExecution } = metadata || {};
    
    console.log(`Handling summarization task for content of length ${input.content.length}`);
    
    try {
      // Generate summary
      const summary = await this.generateSummary(input.content, input.options);
      
      // Extract key points if requested
      let keyPoints = [];
      if (input.options && input.options.extractKeyPoints) {
        keyPoints = await this.extractKeyPoints(input.content);
      }
      
      // Send results back to orchestrator
      this.sendTaskResult(message.id, {
        summary,
        keyPoints,
        originalLength: input.content.length,
        summaryLength: summary.length
      }, { workflowExecution });
    } catch (error) {
      console.error('Error generating summary:', error);
      this.sendTaskError(message.id, error, { workflowExecution });
    }
  }

  /**
   * Generate a summary of content using the LLM service
   * @param {string} content - Content to summarize
   * @param {Object} options - Summarization options
   * @param {string} options.maxLength - Length of the summary ('concise', 'detailed', etc.)
   * @param {string} options.style - Style of the summary ('informative', 'academic', etc.)
   * @returns {Promise<string>} - Generated summary
   */
  async generateSummary(content, options = {}) {
    console.log('Generating summary...');
    
    const maxLength = options.maxLength || 'concise';
    const style = options.style || 'informative';
    
    try {
      const llmResponse = await this.requestService('llm-service', {
        messages: [
          {
            role: 'system',
            content: `You are a summarization assistant. Create a ${maxLength} summary in an ${style} style.`
          },
          {
            role: 'user',
            content: `Please summarize the following content:\n\n${content}`
          }
        ],
        model: this.defaultModel
      }, { timeout: 60000 });
      
      return llmResponse.text;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Extract key points from content using the LLM service
   * @param {string} content - Content to extract key points from
   * @returns {Promise<Array<string>>} - Extracted key points
   */
  async extractKeyPoints(content) {
    console.log('Extracting key points...');
    
    try {
      const llmResponse = await this.requestService('llm-service', {
        messages: [
          {
            role: 'system',
            content: 'You are a content analyzer. Extract the 3-5 most important key points from the content as a JSON array of strings.'
          },
          {
            role: 'user',
            content: `Extract the key points from the following content:\n\n${content}`
          }
        ],
        model: this.defaultModel
      }, { timeout: 60000 });
      
      try {
        // Try to parse the response as JSON
        const text = llmResponse.text;
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          const keyPoints = JSON.parse(jsonMatch[0]);
          return keyPoints;
        } else {
          // If not valid JSON, split by lines
          const lines = text.split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
            .map(line => line.replace(/^[\s-*]+/, '').trim());
          return lines.length > 0 ? lines : [text];
        }
      } catch (error) {
        console.warn('Error parsing key points, returning as plain text:', error);
        return [llmResponse.text];
      }
    } catch (error) {
      console.error('Error extracting key points:', error);
      throw error;
    }
  }
}

module.exports = SummarizationAgent; 