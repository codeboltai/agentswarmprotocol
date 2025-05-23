/**
 * SummarizationAgent class for Agent Swarm Protocol
 * Summarizes content and extracts key information
 */

const SwarmAgentSDK = require('../../../sdk/agentsdk/dist');

class SummarizationAgent extends SwarmAgentSDK {
  constructor(config = {}) {
    // Set default name if not provided
    config.name = config.name || 'Summarization Agent';
    
    // Set capabilities
    config.capabilities = [
      'summarization',
      'text-processing',
      'keyword-extraction',
      'content-analysis'
    ];
    
    // Set description
    config.description = 'Agent that summarizes content and extracts key information';
    
    // Call parent constructor with config
    super(config);

    // Set up logging
    this.logger = {
      info: (message) => console.log(`[INFO] ${message}`),
      warn: (message) => console.warn(`[WARN] ${message}`),
      error: (message) => console.error(`[ERROR] ${message}`)
    };
    
    // Register task handlers
    this.registerTaskHandlers();
    
    this.logger.info('SummarizationAgent initialized');
  }

  /**
   * Register all task handlers for the summarization agent
   */
  registerTaskHandlers() {
    this.registerTaskHandler('summarize:text', this.handleSummarizeText.bind(this));
    this.registerTaskHandler('summarize:document', this.handleSummarizeDocument.bind(this));
    this.registerTaskHandler('extract:keywords', this.handleExtractKeywords.bind(this));
    this.registerTaskHandler('extract:entities', this.handleExtractEntities.bind(this));
    
    // Register a default handler for unrecognized task types
    this.registerDefaultTaskHandler(this.handleDefaultTask.bind(this));
  }

  /**
   * Handle default tasks
   * @param {Object} task - The task data
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} Task result
   */
  async handleDefaultTask(task, metadata) {
    this.logger.warn(`Received unknown task type: ${task.taskType || 'undefined'}`);
    return {
      message: `Unsupported task type: ${task.taskType || 'undefined'}`,
      supportedTaskTypes: [
        'summarize:text',
        'summarize:document',
        'extract:keywords',
        'extract:entities'
      ]
    };
  }

  /**
   * Handle text summarization task
   * @param {Object} task - The task object
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} - Summarization result
   */
  async handleSummarizeText(task, metadata) {
    this.logger.info(`Processing text summarization request`);
    
    const { text, maxLength = 200, format = 'plain' } = task || {};
    
    if (!text) {
      throw new Error('Missing required field: text');
    }
    
    // In a real implementation, this would use an AI model for summarization
    const summary = this.mockSummarizeText(text, maxLength);
    
    return {
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: Math.round((summary.length / text.length) * 100) + '%',
      format,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle document summarization task
   * @param {Object} task - The task object
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} - Summarization result
   */
  async handleSummarizeDocument(task, metadata) {
    this.logger.info(`Processing document summarization request`);
    
    const { 
      document, 
      sections = null,
      maxLength = 500, 
      format = 'markdown' 
    } = task || {};
    
    if (!document) {
      throw new Error('Missing required field: document');
    }
    
    let documentContent;
    if (typeof document === 'string') {
      documentContent = document;
    } else if (document.content) {
      documentContent = document.content;
    } else {
      throw new Error('Invalid document format');
    }
    
    // For a sectioned document, summarize each section
    if (sections) {
      const sectionSummaries = {};
      for (const [sectionName, sectionContent] of Object.entries(sections)) {
        sectionSummaries[sectionName] = this.mockSummarizeText(sectionContent, maxLength / sections.length);
      }
      
      return {
        summary: this.formatSectionedSummary(sectionSummaries, format),
        sectionSummaries,
        originalLength: Object.values(sections).reduce((sum, content) => sum + content.length, 0),
        format,
        timestamp: new Date().toISOString()
      };
    }
    
    // For a regular document, summarize the whole content
    const summary = this.mockSummarizeText(documentContent, maxLength);
    
    return {
      summary,
      originalLength: documentContent.length,
      summaryLength: summary.length,
      compressionRatio: Math.round((summary.length / documentContent.length) * 100) + '%',
      format,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle keyword extraction task
   * @param {Object} task - The task object
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} - Extracted keywords
   */
  async handleExtractKeywords(task, metadata) {
    this.logger.info(`Processing keyword extraction request`);
    
    const { text, maxKeywords = 10 } = task || {};
    
    if (!text) {
      throw new Error('Missing required field: text');
    }
    
    // In a real implementation, this would use NLP techniques to extract keywords
    const keywords = this.mockExtractKeywords(text, maxKeywords);
    
    return {
      keywords,
      count: keywords.length,
      originalTextLength: text.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle entity extraction task
   * @param {Object} task - The task object
   * @param {Object} metadata - Task metadata
   * @returns {Promise<Object>} - Extracted entities
   */
  async handleExtractEntities(task, metadata) {
    this.logger.info(`Processing entity extraction request`);
    
    const { text, entityTypes = ['person', 'location', 'organization', 'date'] } = task || {};
    
    if (!text) {
      throw new Error('Missing required field: text');
    }
    
    // In a real implementation, this would use NER techniques to extract entities
    const entities = this.mockExtractEntities(text, entityTypes);
    
    return {
      entities,
      entityTypeCount: Object.keys(entities).length,
      totalEntitiesFound: Object.values(entities).reduce((sum, arr) => sum + arr.length, 0),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Mock implementation of text summarization
   * @param {string} text - Text to summarize
   * @param {number} maxLength - Maximum length of summary
   * @returns {string} - Summarized text
   * @private
   */
  mockSummarizeText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Simple summary approach - extract first portion up to maxLength
    const summary = text.substring(0, maxLength);
    
    // Try to end at the last complete sentence
    const lastPeriod = summary.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.75) {
      return summary.substring(0, lastPeriod + 1);
    }
    
    return summary + '...';
  }

  /**
   * Format sectioned summary based on desired format
   * @param {Object} sectionSummaries - Object with section names and summaries
   * @param {string} format - Output format
   * @returns {string} - Formatted sectioned summary
   * @private
   */
  formatSectionedSummary(sectionSummaries, format) {
    if (format === 'markdown') {
      let output = '# Document Summary\n\n';
      
      for (const [sectionName, summary] of Object.entries(sectionSummaries)) {
        output += `## ${sectionName}\n\n${summary}\n\n`;
      }
      
      return output;
    } else if (format === 'html') {
      let output = '<h1>Document Summary</h1>';
      
      for (const [sectionName, summary] of Object.entries(sectionSummaries)) {
        output += `<h2>${sectionName}</h2><p>${summary}</p>`;
      }
      
      return output;
    } else {
      // Plain text format
      let output = 'DOCUMENT SUMMARY\n\n';
      
      for (const [sectionName, summary] of Object.entries(sectionSummaries)) {
        output += `=== ${sectionName.toUpperCase()} ===\n${summary}\n\n`;
      }
      
      return output;
    }
  }

  /**
   * Mock implementation of keyword extraction
   * @param {string} text - Text to extract keywords from
   * @param {number} maxKeywords - Maximum number of keywords to extract
   * @returns {Array} - Array of keyword objects with relevance scores
   * @private
   */
  mockExtractKeywords(text, maxKeywords) {
    // Simulate keyword extraction with relevance scores
    // In a real implementation, this would use NLP algorithms
    
    // Get unique words, remove common words, and take most frequent
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['this', 'that', 'with', 'from', 'have', 'there'].includes(word));
    
    // Count word frequency
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Convert to array of [word, count] pairs and sort by count
    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords);
    
    // Convert to keyword objects with normalized relevance scores
    const maxCount = sortedWords.length > 0 ? sortedWords[0][1] : 1;
    return sortedWords.map(([word, count]) => ({
      keyword: word,
      relevance: +(count / maxCount).toFixed(2),
      occurrences: count
    }));
  }

  /**
   * Mock implementation of entity extraction
   * @param {string} text - Text to extract entities from
   * @param {Array} entityTypes - Types of entities to extract
   * @returns {Object} - Object with entity types and extracted entities
   * @private
   */
  mockExtractEntities(text, entityTypes) {
    // In a real implementation, this would use NER models
    const mockEntities = {
      person: ['John Smith', 'Jane Doe', 'Robert Johnson', 'Emily Chen'],
      location: ['New York', 'London', 'Tokyo', 'San Francisco', 'Berlin'],
      organization: ['Acme Corp', 'Global Industries', 'Tech Innovations', 'Research Institute'],
      date: ['January 15, 2023', 'next Monday', 'last week', 'tomorrow'],
      product: ['XPhone 12', 'UltraBook Pro', 'SmartWatch 5', 'CloudService Plus']
    };
    
    // Generate some random entities based on the text length
    const result = {};
    
    entityTypes.forEach(type => {
      if (mockEntities[type]) {
        // The number of entities depends on text length
        const numEntities = Math.min(
          Math.max(1, Math.floor(text.length / 500)),
          mockEntities[type].length
        );
        
        // Select random entities from the mock data
        const entities = [];
        const indices = new Set();
        while (entities.length < numEntities) {
          const idx = Math.floor(Math.random() * mockEntities[type].length);
          if (!indices.has(idx)) {
            indices.add(idx);
            
            // Find a random position in the text to place the entity
            const position = Math.floor(Math.random() * Math.max(1, text.length - 50));
            
            entities.push({
              text: mockEntities[type][idx],
              type: type,
              position: position,
              confidence: +(0.7 + 0.3 * Math.random()).toFixed(2)
            });
          }
        }
        
        result[type] = entities;
      }
    });
    
    return result;
  }
}

module.exports = SummarizationAgent; 