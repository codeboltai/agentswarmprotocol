import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

// Create a child agent with a consistent agent ID
const agent = new SwarmAgentSDK({
  agentId: 'child-agent-001', // Consistent agent ID for reconnections
  name: 'ChildAgent',
  description: 'A child agent that executes tasks delegated from parent agents',
  capabilities: ['execute', 'process', 'analyze'],
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true
});

// Task execution functions
async function processTextTask(data: any): Promise<any> {
  const text = data.text || data.content || '';
  console.log(chalk.blue(`Processing text: "${text}"`));
  
  // Simulate text processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    originalText: text,
    wordCount: text.split(' ').length,
    characterCount: text.length,
    processedAt: new Date().toISOString(),
    processed: true
  };
}

async function calculateTask(data: any): Promise<any> {
  const { operation, numbers } = data;
  console.log(chalk.green(`Performing calculation: ${operation} on [${numbers.join(', ')}]`));
  
  // Simulate calculation processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let result: number;
  switch (operation) {
    case 'sum':
      result = numbers.reduce((a: number, b: number) => a + b, 0);
      break;
    case 'multiply':
      result = numbers.reduce((a: number, b: number) => a * b, 1);
      break;
    case 'average':
      result = numbers.reduce((a: number, b: number) => a + b, 0) / numbers.length;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  return {
    operation,
    numbers,
    result,
    calculatedAt: new Date().toISOString()
  };
}

async function analyzeDataTask(data: any): Promise<any> {
  const dataset = data.dataset || data.data || [];
  console.log(chalk.yellow(`Analyzing dataset with ${dataset.length} items`));
  
  // Simulate data analysis
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const analysis = {
    itemCount: dataset.length,
    dataTypes: [...new Set(dataset.map((item: any) => typeof item))],
    summary: dataset.length > 0 ? {
      first: dataset[0],
      last: dataset[dataset.length - 1],
      sample: dataset.slice(0, 3)
    } : null,
    analyzedAt: new Date().toISOString()
  };
  
  return analysis;
}

// Register a comprehensive task handler
agent.onTask(async (taskData: any, message: TaskExecuteMessage) => {
  const taskId = message.content?.taskId || '';
  const taskType = taskData?.taskType || taskData?.type || 'unknown';
  
  console.log(chalk.cyan(`\n=== CHILD AGENT RECEIVED TASK ===`));
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
    console.log(chalk.yellow(`🔄 Delegating ${taskType} task to GrandChildAgent...`));
      
// Send progress message
agent.sendTaskMessage(taskId, {
  type: 'progress',
  message: `Child delegating ${taskType} task to ChildAgent`,
  data: { progress: 25, status: 'delegating' }
});

try {
  // Delegate to child agent
  const childResult = await agent.executeChildAgentTask('GrandChildAgent', taskData);
  
  // Send progress message
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: `GrandChildAgent completed ${taskType} task`,
    data: { progress: 100, status: 'completed' }
  });
  
  // Send the task result
  agent.sendTaskResult(taskId, {
    type: 'delegated.task.result',
    message: `Task delegated to ChildAgent and completed successfully`,
    delegatedTo: 'GrandChildAgent',
    childResult,
    timestamp: new Date().toISOString()
  });
  
  return {
    response: "Task delegated to ChildAgent and completed successfully",
    delegatedTo: 'GrandChildAgent',
    childResult,
    isComplete: true
  };
} catch (delegationError) {
  console.error(chalk.red(`❌ Error delegating to GrandChildAgent:`), delegationError);
  

}
    
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: `Child agent started processing ${taskType} task`,
      data: { progress: 25, status: 'started' }
    });
    
    let result: any;
    
    // Route task based on type
    switch (taskType) {
      case 'processText':
        result = await processTextTask(taskData);
        break;
      case 'calculate':
        result = await calculateTask(taskData);
        break;
      case 'analyzeData':
        result = await analyzeDataTask(taskData);
        break;
      case 'echo':
        // Simple echo task for testing
        await new Promise(resolve => setTimeout(resolve, 500));
        result = {
          echo: taskData.message || taskData.content || 'No message provided',
          echoedAt: new Date().toISOString(),
          echoedBy: 'ChildAgent'
        };
        break;
      default:
        // Generic task handler
        console.log(chalk.yellow(`Handling generic task: ${taskType}`));
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = {
          taskType,
          processedData: taskData,
          processedAt: new Date().toISOString(),
          processedBy: 'ChildAgent',
          status: 'completed'
        };
    }
    
    // Send another progress message
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: `Child agent completed processing ${taskType} task`,
      data: { progress: 100, status: 'completed' }
    });
    
    console.log(chalk.green(`✅ Task ${taskId} completed successfully`));
    console.log(chalk.cyan(`=== TASK COMPLETED ===\n`));
    
    // Return the result object instead of using sendTaskResult to avoid duplicates
    return {
      type: 'child.task.result',
      taskType,
      result,
      completedAt: new Date().toISOString(),
      completedBy: 'ChildAgent'
    };
    
  } catch (error) {
    console.error(chalk.red(`❌ Error processing task ${taskId}:`), error);
    
    // Send error message
    agent.sendTaskMessage(taskId, {
      type: 'error',
      message: `Error processing ${taskType} task: ${error instanceof Error ? error.message : String(error)}`,
      data: { error: error instanceof Error ? error.message : String(error) }
    });
    
    return { 
      error: `Error processing task: ${error instanceof Error ? error.message : String(error)}`,
      taskType,
      failedAt: new Date().toISOString()
    };
  }
});

// Listen for events
agent.on('connected', () => {
  console.log(chalk.green('✅ Child Agent connected to orchestrator'));
});

agent.on('registered', async () => {
  console.log(chalk.green('✅ Child Agent registered with orchestrator'));
  console.log(chalk.blue('🔄 Child Agent is ready to receive tasks from parent agents'));
});

agent.on('error', (error: any) => {
  console.error(chalk.red('❌ Child Agent error:'), error.message);
});

agent.on('disconnected', () => {
  console.log(chalk.yellow('⚠️  Child Agent disconnected from orchestrator'));
});

// Listen for child agent responses (in case this agent also delegates tasks)
agent.on('childagent.response', (response: any) => {
  console.log(chalk.magenta('📨 Received response from child agent:'), response);
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log(chalk.green('🚀 Child Agent started and connected to orchestrator'));
    console.log(chalk.blue('📋 Available task types:'));
    console.log(chalk.blue('   - processText: Process and analyze text'));
    console.log(chalk.blue('   - calculate: Perform mathematical operations'));
    console.log(chalk.blue('   - analyzeData: Analyze datasets'));
    console.log(chalk.blue('   - echo: Simple echo task for testing'));
    console.log(chalk.blue('   - generic: Handle any other task type'));
  })
  .catch((error: any) => {
    console.error(chalk.red('❌ Connection error:'), error.message);
  });

// Handle process termination
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down Child Agent...'));
  await agent.disconnect();
  process.exit(0);
}); 