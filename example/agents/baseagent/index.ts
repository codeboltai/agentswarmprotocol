import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { v4 as uuidv4 } from 'uuid';

// Create a new simple agent
const agent = new SwarmAgentSDK({
  name: 'SimpleAgent',
  description: 'A basic agent that processes text input',
  capabilities: ['text-processing'],
  orchestratorUrl : 'ws://localhost:3000/'
});

// Register a task handler for text-processing tasks
agent.registerTaskHandler('text-processing', async (taskData, taskMessage) => {
  console.log('Processing text task:', taskData);
  
  // Extract the query content from the task data
  const queryContent = typeof taskData === 'object' && taskData.query ? 
    taskData.query : 
    JSON.stringify(taskData);
  
  // Send a notification message to indicate task has started
  await agent.send({
    id: uuidv4(),
    type: 'task.status',
    content: {
      taskId: taskMessage.content.taskId,
      status: 'in_progress',
      message: 'Starting text-processing task...',
      timestamp: new Date().toISOString(),
      result: {
        inProgress: true
      }
    }
  });
  
  // Simulate some processing time to allow notifications to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Send an additional notification before completing
  await agent.send({
    id: uuidv4(),
    type: 'task.status',
    content: {
      taskId: taskMessage.content.taskId,
      status: 'in_progress',
      message: 'Text processing in progress...',
      timestamp: new Date().toISOString(),
      result: {
        inProgress: true
      }
    }
  });
  
  // Wait again to ensure notifications are processed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simple text processing logic
  const result = {
    processed: true,
    originalText: queryContent,
    processedText: `Processed: ${queryContent}`,
    timestamp: new Date().toISOString()
  };
  
  return result;
});

// Register an empty string handler for tasks with no type
agent.registerTaskHandler('', async (taskData, taskMessage) => {
  console.log('Processing task with empty type:', taskData);
  
  // Extract the query content from the task data
  const queryContent = typeof taskData === 'object' && taskData.query ? 
    taskData.query : 
    JSON.stringify(taskData);
  
  // Send a notification message before completing the task
  await agent.send({
    id: uuidv4(),
    type: 'task.status',
    content: {
      taskId: taskMessage.content.taskId,
      status: 'in_progress',
      message: 'Started processing task with empty type...',
      timestamp: new Date().toISOString(),
      result: {
        inProgress: true
      }
    }
  });
  
  // Ensure notification is processed before completing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simple text processing logic
  const result = {
    processed: true,
    originalText: queryContent,
    processedText: `Processed task with empty type: ${queryContent}`,
    timestamp: new Date().toISOString()
  };
  
  return result;
});

// Register a default handler for any task type that doesn't have a specific handler
agent.registerDefaultTaskHandler(async (taskData, taskMessage) => {
  console.log('Processing default task:', taskData);
  console.log('Task message structure:', JSON.stringify(taskMessage, null, 2));
  
  // Extract the query content from the task data
  const queryContent = typeof taskData === 'object' && taskData.query ? 
    taskData.query : 
    JSON.stringify(taskData);
  
  // Send initial notification message
  await agent.send({
    id: uuidv4(),
    type: 'task.status',
    content: {
      taskId: taskMessage.content.taskId,
      status: 'in_progress',
      message: 'Task received, starting processing...',
      timestamp: new Date().toISOString(),
      result: {
        inProgress: true
      }
    }
  });
  
  // Ensure notification is processed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Send a second notification message
  await agent.send({
    id: uuidv4(),
    type: 'task.status',
    content: {
      taskId: taskMessage.content.taskId,
      status: 'in_progress',
      message: `Processing message: "${queryContent}"`,
      timestamp: new Date().toISOString(),
      result: `Hello! I received your message: "${queryContent}" and processed it successfully.`
    }
  });
  
  // Ensure second notification is processed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simple text processing logic for default handler
  const result = {
    processed: true,
    originalText: queryContent,
    processedText: `Processed with default handler: ${queryContent}`,
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

// Listen for task events specifically
agent.on('task', (task) => {
  setTimeout(() => {
    console.log(`Task received with task handler: ${JSON.stringify(task, null, 2)}`);
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
