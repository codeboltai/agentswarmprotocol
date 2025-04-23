const { Agent } = require('../../../sdk/dist');

/**
 * ResearchAgent - Specialized agent for research tasks
 * 
 * Capabilities:
 * - Gathering information from specified sources
 * - Analyzing and summarizing content
 * - Generating reports and insights
 * - Answering research questions
 */
class ResearchAgent extends Agent {
  constructor() {
    super('research-agent');
    
    this.capabilities = [
      'research',
      'information-gathering',
      'analysis',
      'summarization',
      'report-generation',
      'question-answering'
    ];

    this.supportedSources = [
      'web',
      'scientific-papers',
      'news-articles',
      'databases'
    ];
    
    this.registerTaskHandlers();
  }

  /**
   * Register all task handlers for the research agent
   */
  registerTaskHandlers() {
    this.registerTaskHandler('research:query', this.handleResearchQuery.bind(this));
    this.registerTaskHandler('research:analyze', this.handleAnalyzeContent.bind(this));
    this.registerTaskHandler('research:summarize', this.handleSummarizeContent.bind(this));
    this.registerTaskHandler('research:report', this.handleGenerateReport.bind(this));
  }

  /**
   * Handle a research query task
   * @param {Object} task - The research query task
   * @returns {Promise<Object>} Research results
   */
  async handleResearchQuery(task) {
    console.log(`[ResearchAgent] Processing research query: ${task.data.query}`);
    
    const { query, sources = ['web'], maxResults = 5 } = task.data;
    
    // Validate sources
    const validSources = sources.filter(source => 
      this.supportedSources.includes(source)
    );
    
    if (validSources.length === 0) {
      return {
        error: 'No valid sources provided',
        supportedSources: this.supportedSources
      };
    }
    
    // In a real implementation, this would connect to actual data sources
    // This is a simplified mock implementation
    const results = await this.mockDataCollection(query, validSources, maxResults);
    
    return {
      query,
      sources: validSources,
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle content analysis task
   * @param {Object} task - The analysis task
   * @returns {Promise<Object>} Analysis results
   */
  async handleAnalyzeContent(task) {
    console.log(`[ResearchAgent] Analyzing content: ${task.data.title || 'Untitled'}`);
    
    const { content, analysisType = 'general', depth = 'standard' } = task.data;
    
    if (!content) {
      return {
        error: 'No content provided for analysis'
      };
    }
    
    // Mock analysis process
    const analysis = this.mockContentAnalysis(content, analysisType, depth);
    
    return {
      analysisType,
      depth,
      analysis,
      wordCount: content.split(/\s+/).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle content summarization task
   * @param {Object} task - The summarization task
   * @returns {Promise<Object>} Summarization results
   */
  async handleSummarizeContent(task) {
    console.log(`[ResearchAgent] Summarizing content: ${task.data.title || 'Untitled'}`);
    
    const { content, maxLength = 200, format = 'text' } = task.data;
    
    if (!content) {
      return {
        error: 'No content provided for summarization'
      };
    }
    
    // Mock summarization process
    const summary = this.mockSummarizeContent(content, maxLength);
    
    return {
      summary,
      originalLength: content.length,
      summaryLength: summary.length,
      format,
      compressionRatio: Math.round((summary.length / content.length) * 100) + '%',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle report generation task
   * @param {Object} task - The report generation task
   * @returns {Promise<Object>} Generated report
   */
  async handleGenerateReport(task) {
    console.log(`[ResearchAgent] Generating report: ${task.data.title || 'Untitled Report'}`);
    
    const { 
      title = 'Research Report', 
      findings = [],
      format = 'markdown',
      includeReferences = true
    } = task.data;
    
    if (findings.length === 0) {
      return {
        error: 'No research findings provided for report generation'
      };
    }
    
    // Mock report generation
    const report = this.mockGenerateReport(title, findings, format, includeReferences);
    
    return {
      title,
      report,
      format,
      sectionCount: findings.length,
      includesReferences: includeReferences,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Mock implementation of data collection from various sources
   * @private
   */
  async mockDataCollection(query, sources, maxResults) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return sources.map(source => {
      const resultCount = Math.floor(Math.random() * maxResults) + 1;
      
      return {
        source,
        resultCount,
        results: Array.from({ length: resultCount }, (_, i) => ({
          id: `${source}-${i}`,
          title: `${this.capitalize(source)} result for "${query}" (${i + 1})`,
          snippet: `This is a simulated research result for the query "${query}" from ${source}. In a real implementation, this would contain actual content.`,
          confidence: Math.round(Math.random() * 50 + 50) / 100,
          url: source === 'web' ? `https://example.com/research/${query.replace(/\s+/g, '-')}/${i}` : null
        }))
      };
    });
  }

  /**
   * Mock implementation of content analysis
   * @private
   */
  mockContentAnalysis(content, analysisType, depth) {
    const wordCount = content.split(/\s+/).length;
    
    const results = {
      key_points: [
        "First key point extracted from content",
        "Second key point with important information",
        "Third key point highlighting critical concepts"
      ],
      sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
      complexity: wordCount > 200 ? 'high' : 'medium'
    };
    
    if (analysisType === 'technical' || depth === 'deep') {
      results.technical_terms = [
        { term: "Technical term 1", definition: "Definition of technical term 1" },
        { term: "Technical term 2", definition: "Definition of technical term 2" }
      ];
    }
    
    if (depth === 'deep') {
      results.structural_analysis = {
        coherence: Math.round(Math.random() * 100) / 100,
        argumentative_strength: Math.round(Math.random() * 100) / 100,
        evidence_quality: Math.round(Math.random() * 100) / 100
      };
    }
    
    return results;
  }

  /**
   * Mock implementation of content summarization
   * @private
   */
  mockSummarizeContent(content, maxLength) {
    // Simple mock summary logic - truncate and add ellipsis
    const words = content.split(/\s+/);
    const summaryWordCount = Math.min(words.length, Math.floor(maxLength / 5));
    const summary = words.slice(0, summaryWordCount).join(' ');
    
    return summary.length < content.length ? `${summary}...` : summary;
  }

  /**
   * Mock implementation of report generation
   * @private
   */
  mockGenerateReport(title, findings, format, includeReferences) {
    if (format === 'markdown') {
      let report = `# ${title}\n\n`;
      
      report += `## Executive Summary\n\n`;
      report += `This research report contains ${findings.length} key findings.\n\n`;
      
      report += `## Key Findings\n\n`;
      findings.forEach((finding, index) => {
        report += `### Finding ${index + 1}: ${finding.title || 'Untitled Finding'}\n\n`;
        report += `${finding.description || 'No description provided'}\n\n`;
        
        if (finding.evidencePoints && finding.evidencePoints.length > 0) {
          report += `#### Evidence:\n\n`;
          finding.evidencePoints.forEach(point => {
            report += `- ${point}\n`;
          });
          report += `\n`;
        }
      });
      
      if (includeReferences) {
        report += `## References\n\n`;
        report += `1. Reference One\n`;
        report += `2. Reference Two\n`;
        report += `3. Reference Three\n`;
      }
      
      return report;
    } else {
      // For other formats, return a simplified version
      return `Report: ${title} with ${findings.length} findings`;
    }
  }

  /**
   * Helper to capitalize the first letter of a string
   * @private
   */
  capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

module.exports = ResearchAgent;

// If this file is being run directly, create and start the agent
if (require.main === module) {
  const agent = new ResearchAgent();
  agent.connect(process.env.ORCHESTRATOR_URL || 'ws://localhost:3000')
    .then(() => {
      console.log('[ResearchAgent] Connected to orchestrator');
    })
    .catch(error => {
      console.error('[ResearchAgent] Failed to connect:', error);
    });
} 