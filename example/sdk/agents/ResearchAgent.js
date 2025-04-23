const SwarmAgentSDK = require('../SwarmAgentSDK');

/**
 * ResearchAgent - Agent for performing web searches and research tasks
 */
class ResearchAgent extends SwarmAgentSDK {
  /**
   * Create a new ResearchAgent
   * @param {Object} config - Agent configuration
   */
  constructor(config = {}) {
    super({
      name: config.name || 'research-agent',
      capabilities: ['web-search', 'information-retrieval', 'research'],
      orchestratorUrl: config.orchestratorUrl,
      manifest: {
        description: 'An agent that performs web searches and research tasks',
        version: '1.0.0',
        requiredServices: ['search-service', 'llm-service']
      },
      ...config
    });
    
    this.defaultModel = config.defaultModel || process.env.DEFAULT_MODEL || 'gpt-4';
    this.searchApiKey = config.searchApiKey || process.env.SEARCH_API_KEY;
    
    // Register task handler
    this.on('task', this.handleTask.bind(this));
  }

  /**
   * Handle incoming tasks
   * @param {Object} message - Task message
   */
  async handleTask(message) {
    if (message.type === 'task.research') {
      await this.handleResearchTask(message);
    }
  }

  /**
   * Handle a research task
   * @param {Object} message - Research task message
   */
  async handleResearchTask(message) {
    const { input, metadata } = message.content;
    const { workflowExecution } = metadata || {};
    
    console.log(`Handling research task: ${input.query}`);
    
    try {
      // Perform web search
      const searchResults = await this.performSearch(input.query, input.maxResults);
      
      // Analyze search results using LLM
      const analysis = await this.analyzeResults(input.query, searchResults);
      
      // Send results back to orchestrator
      this.sendTaskResult(message.id, {
        query: input.query,
        searchResults,
        analysis
      }, { workflowExecution });
    } catch (error) {
      console.error('Error performing research:', error);
      this.sendTaskError(message.id, error, { workflowExecution });
    }
  }

  /**
   * Perform a web search using the search service
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<Array>} - Search results
   */
  async performSearch(query, maxResults = 5) {
    console.log(`Performing search for: ${query}`);
    
    try {
      const searchResponse = await this.requestService('search-service', {
        query,
        maxResults
      });
      
      return searchResponse.results || [];
    } catch (error) {
      console.error('Error performing search:', error);
      throw error;
    }
  }

  /**
   * Analyze search results using the LLM service
   * @param {string} query - Original search query
   * @param {Array} searchResults - Search results to analyze
   * @returns {Promise<string>} - Analysis of the search results
   */
  async analyzeResults(query, searchResults) {
    console.log(`Analyzing search results for: ${query}`);
    
    if (!searchResults || searchResults.length === 0) {
      return 'No search results found to analyze.';
    }
    
    try {
      const llmResponse = await this.requestService('llm-service', {
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Analyze the search results and provide a concise summary.'
          },
          {
            role: 'user',
            content: `Based on the following search results for the query "${query}", provide a concise summary of the main findings and information:\n\n${JSON.stringify(searchResults, null, 2)}`
          }
        ],
        model: this.defaultModel
      }, { timeout: 60000 });
      
      return llmResponse.text;
    } catch (error) {
      console.error('Error analyzing results:', error);
      throw error;
    }
  }
}

module.exports = ResearchAgent; 