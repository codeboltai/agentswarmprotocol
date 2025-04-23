---
sidebar_position: 2
---

# Research Agent Example

This example demonstrates how to build a research agent that can gather, analyze, and synthesize information from various sources.

## Overview

The research agent is designed to perform comprehensive research on a given topic by searching across multiple sources, extracting relevant information, and producing a structured report.

## Implementation

### Step 1: Set up the basic agent structure

```typescript
import { Agent, Orchestrator } from '@agent-swarm/sdk';

const researchAgent = new Agent({
  name: 'research-agent',
  description: 'Performs comprehensive research on specified topics',
  capabilities: ['web-search', 'content-extraction', 'summarization', 'fact-checking']
});
```

### Step 2: Define the research task interface

```typescript
interface ResearchTask {
  topic: string;
  depth: 'basic' | 'comprehensive' | 'expert';
  sources?: string[];
  maxSources?: number;
  format?: 'markdown' | 'html' | 'text';
  includeCitations: boolean;
}

interface ResearchResult {
  summary: string;
  keyFindings: string[];
  sources: {
    title: string;
    url: string;
    relevance: number;
    extractedInfo: string;
  }[];
  fullReport: string;
  citations: Record<string, string>;
}
```

### Step 3: Implement the research handler

```typescript
researchAgent.registerHandler('research', async (task) => {
  const researchParams: ResearchTask = task.inputs;
  
  // Step 1: Search for relevant sources
  const sources = await findSources(researchParams.topic, researchParams.sources, researchParams.maxSources);
  
  // Step 2: Extract information from each source
  const extractedInfo = await Promise.all(
    sources.map(source => extractInformation(source, researchParams.topic))
  );
  
  // Step 3: Synthesize information
  const synthesis = synthesizeInformation(extractedInfo, researchParams.topic, researchParams.depth);
  
  // Step 4: Generate report
  const report = generateReport(synthesis, researchParams.format || 'markdown', researchParams.includeCitations);
  
  return report;
});
```

### Step 4: Implement research functions

```typescript
async function findSources(topic: string, preferredSources: string[] = [], maxSources: number = 10) {
  // Implement search logic to find relevant sources
  // This could use web search APIs, database queries, or other data sources
  
  // Example implementation
  const searchResults = await webSearchAPI.search(topic, { limit: maxSources * 2 });
  
  // Filter and rank results
  const rankedSources = rankSourcesByRelevance(searchResults, topic);
  
  // Return top sources
  return rankedSources.slice(0, maxSources);
}

async function extractInformation(source, topic) {
  // Implement logic to extract relevant information from a source
  // This could involve web scraping, text processing, etc.
  
  // Example implementation
  const content = await fetchContent(source.url);
  const relevantContent = extractRelevantContent(content, topic);
  
  return {
    ...source,
    extractedInfo: relevantContent
  };
}

function synthesizeInformation(extractedInfo, topic, depth) {
  // Implement logic to synthesize information from multiple sources
  // This could involve summarization, fact checking, etc.
  
  // Example implementation
  const allContent = extractedInfo.map(info => info.extractedInfo).join('\n\n');
  const summary = generateSummary(allContent, depth);
  const keyFindings = extractKeyFindings(allContent, topic);
  
  return {
    summary,
    keyFindings,
    sources: extractedInfo
  };
}

function generateReport(synthesis, format, includeCitations) {
  // Implement logic to generate a formatted report
  
  // Example implementation
  const report = formatReport(synthesis, format);
  
  // Add citations if requested
  const citations = includeCitations ? generateCitations(synthesis.sources) : {};
  
  return {
    ...synthesis,
    fullReport: report,
    citations
  };
}
```

### Step 5: Start the agent

```typescript
// Connect to orchestrator
const orchestrator = new Orchestrator('http://localhost:3000');
researchAgent.connect(orchestrator);

// Start the agent
const port = 8081;
researchAgent.start(port);
console.log(`Research agent started on port ${port}`);
```

## Usage

To use the research agent:

```typescript
// Client-side code
const response = await fetch('http://localhost:3000/api/v1/tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    type: 'research',
    description: 'Research on renewable energy technologies',
    inputs: {
      topic: 'Recent advancements in solar panel efficiency',
      depth: 'comprehensive',
      sources: ['academic', 'news', 'industry-reports'],
      maxSources: 15,
      format: 'markdown',
      includeCitations: true
    },
    agents: ['research-agent']
  })
});

const result = await response.json();
console.log(result.outputs.summary); // Research summary
console.log(result.outputs.fullReport); // Complete research report
```

## Extensions

The research agent can be extended with additional capabilities:

- **Multi-agent collaboration**: Collaborate with specialized agents for deeper analysis
- **Periodic updates**: Schedule regular research updates on evolving topics
- **Interactive research**: Allow users to refine research direction interactively
- **Visual data**: Include charts and visualizations in research reports
- **Expert validation**: Submit findings to domain expert agents for validation 