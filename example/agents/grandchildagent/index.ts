import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

// Create a grandchild agent with a consistent agent ID
const agent = new SwarmAgentSDK({
  agentId: 'grandchild-agent-001', // Consistent agent ID for reconnections
  name: 'GrandChildAgent',
  description: 'A grandchild agent that executes specialized tasks delegated from child agents',
  capabilities: ['execute', 'process', 'analyze', 'transform', 'validate'],
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true
});

// Specialized task execution functions for grandchild agent
async function advancedTextProcessing(data: any): Promise<any> {
  const text = data.text || data.content || '';
  console.log(chalk.blue(`🔍 Advanced text processing: "${text}"`));
  
  // Simulate advanced text processing
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  const words = text.split(' ').filter((word: string) => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  
  return {
    originalText: text,
    wordCount: words.length,
    characterCount: text.length,
    sentenceCount: sentences.length,
    averageWordsPerSentence: sentences.length > 0 ? (words.length / sentences.length).toFixed(2) : 0,
    longestWord: words.reduce((a: string, b: string) => a.length > b.length ? a : b, ''),
    shortestWord: words.reduce((a: string, b: string) => a.length < b.length ? a : b, words[0] || ''),
    uniqueWords: [...new Set(words.map((w: string) => w.toLowerCase()))].length,
    processedAt: new Date().toISOString(),
    processedBy: 'GrandChildAgent',
    processingType: 'advanced'
  };
}

async function complexCalculation(data: any): Promise<any> {
  const { operation, numbers, precision = 2 } = data;
  console.log(chalk.green(`🧮 Complex calculation: ${operation} on [${numbers.join(', ')}] with precision ${precision}`));
  
  // Simulate complex calculation processing
  await new Promise(resolve => setTimeout(resolve, 800));
  
  let result: number;
  let additionalMetrics: any = {};
  
  switch (operation) {
    case 'sum':
      result = numbers.reduce((a: number, b: number) => a + b, 0);
      additionalMetrics = {
        mean: result / numbers.length,
        variance: numbers.reduce((acc: number, val: number) => acc + Math.pow(val - (result / numbers.length), 2), 0) / numbers.length
      };
      break;
    case 'multiply':
      result = numbers.reduce((a: number, b: number) => a * b, 1);
      additionalMetrics = {
        geometricMean: Math.pow(Math.abs(result), 1 / numbers.length)
      };
      break;
    case 'average':
      result = numbers.reduce((a: number, b: number) => a + b, 0) / numbers.length;
      additionalMetrics = {
        median: [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)],
        standardDeviation: Math.sqrt(numbers.reduce((acc: number, val: number) => acc + Math.pow(val - result, 2), 0) / numbers.length)
      };
      break;
    case 'fibonacci':
      // Generate fibonacci sequence up to the first number in the array
      const n = numbers[0] || 10;
      const fib = [0, 1];
      for (let i = 2; i < n; i++) {
        fib[i] = fib[i - 1] + fib[i - 2];
      }
      result = fib[n - 1] || 0;
      additionalMetrics = { sequence: fib.slice(0, n) };
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  return {
    operation,
    numbers,
    result: parseFloat(result.toFixed(precision)),
    additionalMetrics,
    calculatedAt: new Date().toISOString(),
    calculatedBy: 'GrandChildAgent',
    precision
  };
}

async function deepDataAnalysis(data: any): Promise<any> {
  const dataset = data.dataset || data.data || [];
  console.log(chalk.yellow(`📊 Deep data analysis on dataset with ${dataset.length} items`));
  
  // Simulate deep data analysis
  await new Promise(resolve => setTimeout(resolve, 1800));
  
  const typeAnalysis = dataset.reduce((acc: any, item: any) => {
    const type = typeof item;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  const numericData = dataset.filter((item: any) => typeof item === 'number');
  const stringData = dataset.filter((item: any) => typeof item === 'string');
  
  const analysis = {
    itemCount: dataset.length,
    typeDistribution: typeAnalysis,
    dataTypes: Object.keys(typeAnalysis),
    numericAnalysis: numericData.length > 0 ? {
      count: numericData.length,
      sum: numericData.reduce((a: number, b: number) => a + b, 0),
      average: numericData.reduce((a: number, b: number) => a + b, 0) / numericData.length,
      min: Math.min(...numericData),
      max: Math.max(...numericData),
      range: Math.max(...numericData) - Math.min(...numericData)
    } : null,
    stringAnalysis: stringData.length > 0 ? {
      count: stringData.length,
      totalLength: stringData.reduce((acc: number, str: string) => acc + str.length, 0),
      averageLength: stringData.reduce((acc: number, str: string) => acc + str.length, 0) / stringData.length,
      longestString: stringData.reduce((a: string, b: string) => a.length > b.length ? a : b, ''),
      shortestString: stringData.reduce((a: string, b: string) => a.length < b.length ? a : b, stringData[0] || '')
    } : null,
    summary: dataset.length > 0 ? {
      first: dataset[0],
      last: dataset[dataset.length - 1],
      sample: dataset.slice(0, Math.min(5, dataset.length)),
      uniqueValues: [...new Set(dataset)].length
    } : null,
    analyzedAt: new Date().toISOString(),
    analyzedBy: 'GrandChildAgent',
    analysisType: 'deep'
  };
  
  return analysis;
}

async function dataTransformation(data: any): Promise<any> {
  const { dataset, transformType = 'normalize' } = data;
  console.log(chalk.magenta(`🔄 Data transformation: ${transformType} on ${dataset.length} items`));
  
  // Simulate data transformation
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let transformedData: any[];
  let transformationInfo: any = {};
  
  switch (transformType) {
    case 'normalize':
      const numericItems = dataset.filter((item: any) => typeof item === 'number');
      if (numericItems.length > 0) {
        const min = Math.min(...numericItems);
        const max = Math.max(...numericItems);
        const range = max - min;
        transformedData = dataset.map((item: any) => 
          typeof item === 'number' ? (range > 0 ? (item - min) / range : 0) : item
        );
        transformationInfo = { min, max, range, normalizedCount: numericItems.length };
      } else {
        transformedData = dataset;
        transformationInfo = { message: 'No numeric data to normalize' };
      }
      break;
    case 'uppercase':
      transformedData = dataset.map((item: any) => 
        typeof item === 'string' ? item.toUpperCase() : item
      );
      transformationInfo = { 
        stringCount: dataset.filter((item: any) => typeof item === 'string').length 
      };
      break;
    case 'reverse':
      transformedData = [...dataset].reverse();
      transformationInfo = { originalLength: dataset.length };
      break;
    case 'filter_numbers':
      transformedData = dataset.filter((item: any) => typeof item === 'number');
      transformationInfo = { 
        originalCount: dataset.length, 
        filteredCount: transformedData.length 
      };
      break;
    default:
      transformedData = dataset;
      transformationInfo = { message: `Unknown transformation: ${transformType}` };
  }
  
  return {
    originalData: dataset,
    transformedData,
    transformType,
    transformationInfo,
    transformedAt: new Date().toISOString(),
    transformedBy: 'GrandChildAgent'
  };
}

// Register a comprehensive task handler
agent.onTask(async (taskData: any, message: TaskExecuteMessage) => {
  const taskId = message.content?.taskId || '';
  const taskType = taskData?.taskType || taskData?.type || 'unknown';
  
  console.log(chalk.cyan(`\n=== GRANDCHILD AGENT RECEIVED TASK ===`));
  console.log(chalk.cyan(`Task ID: ${taskId}`));
  console.log(chalk.cyan(`Task Type: ${taskType}`));
  console.log(chalk.cyan(`Task Data:`, JSON.stringify(taskData, null, 2)));
  
  // Check if this task was requested by another agent
  if (taskData.metadata?.requestingAgent) {
    console.log(chalk.magenta(`Requested by agent: ${taskData.metadata.requestingAgent.name} (${taskData.metadata.requestingAgent.id})`));
  }
  
  if (!taskId) {
    console.error('No taskId found in message');
    return { error: 'No taskId found in message' };
  }
  
  try {
    // Send progress message
    console.log(chalk.cyan(`Sending progress update for task ${taskId}`));
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: `Grandchild agent started processing ${taskType} task`,
      data: { progress: 20, status: 'started', agent: 'GrandChildAgent' }
    });
    
    let result: any;
    
    // Route task based on type
    switch (taskType) {
      case 'advancedTextProcessing':
        result = await advancedTextProcessing(taskData);
        break;
      case 'complexCalculation':
        result = await complexCalculation(taskData);
        break;
      case 'deepDataAnalysis':
        result = await deepDataAnalysis(taskData);
        break;
      case 'dataTransformation':
        result = await dataTransformation(taskData);
        break;
      case 'echo':
        // Enhanced echo task for testing
        await new Promise(resolve => setTimeout(resolve, 600));
        result = {
          echo: taskData.message || taskData.content || 'No message provided',
          echoedAt: new Date().toISOString(),
          echoedBy: 'GrandChildAgent',
          echoLevel: 'grandchild',
          enhancedEcho: `[GRANDCHILD] ${taskData.message || taskData.content || 'No message provided'}`
        };
        break;
      case 'processText':
        // Enhanced text processing (fallback to advanced)
        result = await advancedTextProcessing(taskData);
        break;
      case 'calculate':
        // Enhanced calculation (fallback to complex)
        result = await complexCalculation(taskData);
        break;
      case 'analyzeData':
        // Enhanced data analysis (fallback to deep)
        result = await deepDataAnalysis(taskData);
        break;
      default:
        // Generic task handler with grandchild-specific processing
        console.log(chalk.yellow(`Handling generic task: ${taskType}`));
        await new Promise(resolve => setTimeout(resolve, 1200));
        result = {
          taskType,
          processedData: taskData,
          processedAt: new Date().toISOString(),
          processedBy: 'GrandChildAgent',
          status: 'completed',
          specialization: 'grandchild-enhanced',
          processingLevel: 'deep'
        };
    }
    
    // Send progress message
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: `Grandchild agent completed processing ${taskType} task`,
      data: { progress: 100, status: 'completed', agent: 'GrandChildAgent' }
    });
    
    console.log(chalk.green(`✅ Task ${taskId} completed successfully by GrandChildAgent`));
    console.log(chalk.cyan(`=== GRANDCHILD TASK COMPLETED ===\n`));
    
    // Return the result object
    return {
      type: 'grandchild.task.result',
      taskType,
      result,
      completedAt: new Date().toISOString(),
      completedBy: 'GrandChildAgent',
      processingLevel: 'grandchild'
    };
    
  } catch (error) {
    console.error(chalk.red(`❌ Error processing task ${taskId} in GrandChildAgent:`), error);
    
    // Send error message
    agent.sendTaskMessage(taskId, {
      type: 'error',
      message: `Error processing ${taskType} task in GrandChildAgent: ${error instanceof Error ? error.message : String(error)}`,
      data: { error: error instanceof Error ? error.message : String(error), agent: 'GrandChildAgent' }
    });
    
    return { 
      error: `Error processing task: ${error instanceof Error ? error.message : String(error)}`,
      taskType,
      failedAt: new Date().toISOString(),
      failedBy: 'GrandChildAgent'
    };
  }
});

// Listen for events
agent.on('connected', () => {
  console.log(chalk.green('✅ GrandChild Agent connected to orchestrator'));
});

agent.on('registered', async () => {
  console.log(chalk.green('✅ GrandChild Agent registered with orchestrator'));
  console.log(chalk.blue('🔄 GrandChild Agent is ready to receive tasks from child agents'));
});

agent.on('error', (error: any) => {
  console.error(chalk.red('❌ GrandChild Agent error:'), error.message);
});

agent.on('disconnected', () => {
  console.log(chalk.yellow('⚠️  GrandChild Agent disconnected from orchestrator'));
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log(chalk.green('🚀 GrandChild Agent started and connected to orchestrator'));
    console.log(chalk.blue('📋 Available specialized task types:'));
    console.log(chalk.blue('   - advancedTextProcessing: Advanced text analysis with detailed metrics'));
    console.log(chalk.blue('   - complexCalculation: Complex mathematical operations with statistics'));
    console.log(chalk.blue('   - deepDataAnalysis: Deep analysis of datasets with comprehensive metrics'));
    console.log(chalk.blue('   - dataTransformation: Transform data with various algorithms'));
    console.log(chalk.blue('   - echo: Enhanced echo task for testing (grandchild level)'));
    console.log(chalk.blue('   - processText/calculate/analyzeData: Enhanced versions of basic tasks'));
    console.log(chalk.blue('   - generic: Handle any other task type with grandchild-level processing'));
  })
  .catch((error: any) => {
    console.error(chalk.red('❌ Connection error:'), error.message);
  });

// Handle process termination
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down GrandChild Agent...'));
  await agent.disconnect();
  process.exit(0);
}); 