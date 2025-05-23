# Research Agent

The Research Agent is a specialized agent within the Agent Swarm Protocol ecosystem designed to perform research tasks, analyze content, summarize information, and generate reports.

## Capabilities

The Research Agent provides the following core capabilities:

- **Research Queries**: Search for information on specific topics across various sources.
- **Content Analysis**: Analyze text content to extract key points, sentiment, and other insights.
- **Content Summarization**: Create concise summaries of longer content.
- **Report Generation**: Compile research findings into structured reports.

## Task Types

The agent handles the following task types:

| Task Type | Description |
|-----------|-------------|
| `research.query` | Perform a research query on a specific topic |
| `research.analyze` | Analyze provided content |
| `research.summarize` | Summarize provided content |
| `research.generateReport` | Generate a report based on research findings |

## Example Usage

### Research Query

```javascript
const task = {
  agentId: 'research-agent',
  type: 'research.query',
  data: {
    query: 'Advances in quantum computing',
    sources: ['web', 'news', 'academic'],
    maxResults: 5,
    user: { name: 'Alice' }
  }
};

const response = await client.sendTask(task);
```

### Content Analysis

```javascript
const task = {
  agentId: 'research-agent',
  type: 'research.analyze',
  data: {
    content: 'The text to be analyzed...',
    analysisType: 'comprehensive',
    user: { name: 'Bob' }
  }
};

const response = await client.sendTask(task);
```

### Content Summarization

```javascript
const task = {
  agentId: 'research-agent',
  type: 'research.summarize',
  data: {
    content: 'The text to be summarized...',
    maxLength: 200,
    user: { name: 'Charlie' }
  }
};

const response = await client.sendTask(task);
```

### Report Generation

```javascript
const task = {
  agentId: 'research-agent',
  type: 'research.generateReport',
  data: {
    findings: [...], // Array of research findings
    format: 'markdown',
    title: 'Research Report on Quantum Computing',
    includeReferences: true,
    user: { name: 'Diana' }
  }
};

const response = await client.sendTask(task);
```

## Running the Example

An example client script is provided at `example/sdk/examples/run-research-agent.js` to demonstrate how to interact with the Research Agent:

```bash
# Ensure the orchestrator is running
node example/sdk/examples/run-research-agent.js
```

This will start an interactive session where you can send various research tasks to the agent and see the responses.

## Implementation Details

The Research Agent is implemented in `research-agent.js` and includes mock implementations for research operations since actual data collection, analysis, and summarization would require external API integrations or AI models.

In a production environment, you would replace these mock implementations with calls to actual search engines, AI models, and other research tools.

## Extending the Agent

To extend the agent with real research capabilities:

1. Integrate with search engines or databases for data collection
2. Connect to AI services for content analysis and summarization
3. Implement domain-specific knowledge extraction
4. Add authentication for accessing premium research sources

## Integration with Other Agents

The Research Agent can be used in conjunction with other agents in the Agent Swarm Protocol, such as:

- **Conversation Agent**: To answer user questions based on research findings
- **Task Agent**: To break down complex research tasks into smaller steps
- **Writing Agent**: To create polished articles based on research results 