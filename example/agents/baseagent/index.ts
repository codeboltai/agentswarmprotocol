import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { v4 as uuidv4 } from 'uuid';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';

// Generate a fixed agent ID that won't change between reconnects
const AGENT_ID = uuidv4();
console.log(`Using Agent ID: ${AGENT_ID}`);

// Create a new simple agent
const agent = new SwarmAgentSDK({
  agentId: AGENT_ID,
  name: 'SimpleAgent',
  description: 'A basic agent that processes text input',
  capabilities: ['text-processing'],
  orchestratorUrl: 'ws://localhost:3000/',
  manifest: {
    id: AGENT_ID // Explicitly include ID in manifest
  }
});

// Register a single task handler for all tasks
agent.onTask(async (taskData: any, taskMessage: TaskExecuteMessage) => {
  console.log('Processing task:', taskData);
  
  // Extract the query content from the task data
  const queryContent = typeof taskData === 'object' && taskData.query ? 
    taskData.query : 
    JSON.stringify(taskData);
  
  // Send a notification message to indicate task has started
  agent.sendTaskMessage(taskMessage.content.taskId, {
    status: 'in_progress',
    message: 'Starting task processing...',
    timestamp: new Date().toISOString(),
    result: {
      inProgress: true
    }
  });
  
  // Simulate some processing time to allow notifications to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Send an additional notification before completing
  agent.sendTaskMessage(taskMessage.content.taskId, {
    status: 'in_progress',
    message: 'Processing in progress...',
    timestamp: new Date().toISOString(),
    result: {
      inProgress: true
    }
  });
  
  // Wait again to ensure notifications are processed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simple text processing logic
  const result = {
    processed: true,
    originalText: queryContent,
    processedText: `Processed: ${queryContent}`,
    timestamp: new Date().toISOString(),
    replyMessage: `Hello! I received your message: "${queryContent}" and processed it successfully.`
  };
  
  return result;
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Connected to orchestrator');
  })
  .catch(error => {
    console.error('Error connecting to orchestrator:', error.message);
  });

// Listen for all messages to debug what's happening
agent.on('raw-message', (msg) => {
  console.log(`Received raw message: ${JSON.stringify(msg, null, 2)}`);
  if (msg.type === 'task.execute') {
    console.log('Task Execute Message Details:');
    console.log(`- Task ID: ${msg.content?.taskId}`);
    console.log(`- Task Type: ${msg.content?.taskType || 'undefined'}`);
    console.log(`- Content: ${JSON.stringify(msg.content, null, 2)}`);
  }
});

// Listen for registration events
agent.on('registered', (content) => {
  console.log(`Agent registered successfully with ID: ${content.agentId}`);
});

// Listen for task events specifically
agent.on('task', (taskData: any, taskMessage: any) => {
  setTimeout(() => {
    console.log(`Task received: ${JSON.stringify(taskData, null, 2)}`);
    console.log(`Task message: ${JSON.stringify(taskMessage, null, 2)}`);
  }, 2000);
});

// Listen for errors
agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

// Listen for disconnection
agent.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

console.log('Simple agent initialized and waiting for tasks...');
