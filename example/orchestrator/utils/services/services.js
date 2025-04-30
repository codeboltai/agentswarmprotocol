const fetch = require('node-fetch');

/**
 * Set up core services for the ASP Orchestrator
 * @param {Object} config - Configuration options
 * @returns {Object} - Map of service functions
 */
function setupServices(config = {}) {
  const openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  const searchApiKey = config.searchApiKey || process.env.SEARCH_API_KEY;
  const defaultModel = config.defaultModel || process.env.DEFAULT_MODEL || 'gpt-4';
  
  return {
    // LLM service using OpenAI API
    'llm-service': async (params, context) => {
      console.log('LLM service called with params:', JSON.stringify(params, null, 2));
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const model = params.model || defaultModel;
      const messages = params.messages || [];
      
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 1000
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        return {
          text: data.choices[0].message.content,
          model: data.model,
          usage: data.usage
        };
      } catch (error) {
        console.error('LLM service error:', error);
        throw new Error(`LLM service error: ${error.message}`);
      }
    },
    
    // Web search service
    'search-service': async (params, context) => {
      console.log('Search service called with params:', JSON.stringify(params, null, 2));
      
      if (!searchApiKey) {
        // Use mock data if no API key is available
        console.warn('No search API key, using mock data');
        return mockSearchResults(params.query);
      }
      
      const query = params.query;
      const maxResults = params.maxResults || 5;
      
      try {
        // This is a placeholder. In a real implementation, you would use a search API.
        // For example: Google Custom Search, Bing Search API, etc.
        const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${maxResults}`, {
          headers: {
            'Authorization': `Bearer ${searchApiKey}`
          }
        });
        
        if (!response.ok) {
          // Fallback to mock data if the API fails
          console.warn('Search API failed, using mock data');
          return mockSearchResults(query);
        }
        
        const data = await response.json();
        return {
          results: data.results,
          totalResults: data.totalResults
        };
      } catch (error) {
        console.error('Search service error:', error);
        // Fallback to mock data
        return mockSearchResults(query);
      }
    }
  };
}

/**
 * Generate mock search results for demonstration purposes
 * @param {string} query - The search query
 * @returns {Object} - Mock search results
 */
function mockSearchResults(query) {
  const now = new Date().toISOString();
  
  return {
    results: [
      {
        title: `Latest research on ${query}`,
        url: `https://example.com/research/${query.toLowerCase().replace(/\s+/g, '-')}`,
        snippet: `Comprehensive research on ${query} showing significant advances in the field. This paper discusses the latest methodologies and findings.`,
        date: now
      },
      {
        title: `Understanding ${query}: A Comprehensive Guide`,
        url: `https://example.com/guides/${query.toLowerCase().replace(/\s+/g, '-')}`,
        snippet: `This guide provides an in-depth explanation of ${query}, covering fundamental concepts and advanced applications.`,
        date: now
      },
      {
        title: `The Future of ${query}`,
        url: `https://example.com/trends/${query.toLowerCase().replace(/\s+/g, '-')}`,
        snippet: `Experts predict significant developments in ${query} over the next decade. This article explores upcoming trends and innovations.`,
        date: now
      }
    ],
    totalResults: 3,
    note: 'These are mock results for demonstration purposes'
  };
}

module.exports = { setupServices }; 