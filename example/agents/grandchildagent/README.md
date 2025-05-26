# GrandChild Agent

A specialized agent that receives and executes advanced tasks delegated from child agents in the Agent Swarm Protocol hierarchy.

## Overview

The GrandChild Agent is the third level in the agent hierarchy:
- **Client** → **Base Agent** → **Child Agent** → **GrandChild Agent**

This agent provides specialized, advanced processing capabilities that extend beyond the basic functionality of parent agents.

## Features

### Specialized Task Types

1. **advancedTextProcessing**: Advanced text analysis with detailed metrics
   - Word count, character count, sentence analysis
   - Average words per sentence, longest/shortest words
   - Unique word count and comprehensive text statistics

2. **complexCalculation**: Complex mathematical operations with statistics
   - Enhanced arithmetic operations (sum, multiply, average)
   - Statistical metrics (variance, standard deviation, median)
   - Special operations like Fibonacci sequence generation

3. **deepDataAnalysis**: Deep analysis of datasets with comprehensive metrics
   - Type distribution analysis
   - Numeric data statistics (min, max, range, average)
   - String data analysis (length statistics, longest/shortest)
   - Unique value counting and sampling

4. **dataTransformation**: Transform data with various algorithms
   - Normalization of numeric data
   - String transformations (uppercase)
   - Data filtering and reversal
   - Custom transformation pipelines

5. **Enhanced Basic Tasks**: Upgraded versions of standard tasks
   - `processText` → Advanced text processing
   - `calculate` → Complex calculations
   - `analyzeData` → Deep data analysis

6. **echo**: Enhanced echo task for testing with grandchild-level identification

## Installation

```bash
cd example/agents/grandchildagent
npm install
```

## Usage

### Start the Agent

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Agent Configuration

- **Agent ID**: `grandchild-agent-001`
- **Name**: `GrandChildAgent`
- **Capabilities**: `['execute', 'process', 'analyze', 'transform', 'validate']`
- **Orchestrator URL**: `ws://localhost:3000`

## Task Flow Example

```
Client Request → Base Agent → Child Agent → GrandChild Agent
                                          ↓
                                    Advanced Processing
                                          ↓
                                    Enhanced Results
```

## Task Examples

### Advanced Text Processing
```javascript
{
  taskType: 'advancedTextProcessing',
  text: 'The Agent Swarm Protocol enables seamless communication between multiple agents.'
}
```

### Complex Calculation
```javascript
{
  taskType: 'complexCalculation',
  operation: 'average',
  numbers: [10, 20, 30, 40, 50],
  precision: 3
}
```

### Deep Data Analysis
```javascript
{
  taskType: 'deepDataAnalysis',
  dataset: ['apple', 'banana', 42, true, null, 'grape', 100]
}
```

### Data Transformation
```javascript
{
  taskType: 'dataTransformation',
  dataset: [1, 2, 3, 4, 5],
  transformType: 'normalize'
}
```

## Response Format

All responses include:
- `type`: 'grandchild.task.result'
- `taskType`: The original task type
- `result`: The processed result with enhanced data
- `completedAt`: Timestamp
- `completedBy`: 'GrandChildAgent'
- `processingLevel`: 'grandchild'

## Dependencies

- `@agent-swarm/agent-sdk`: Core SDK for agent communication
- `chalk`: Console output coloring
- `uuid`: Unique identifier generation
- `typescript`: TypeScript support
- `ts-node`: TypeScript execution

## Development

The agent uses TypeScript and includes comprehensive error handling, progress reporting, and detailed logging for debugging and monitoring. 