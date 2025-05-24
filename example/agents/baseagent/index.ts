import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';
import { v4 as uuidv4 } from 'uuid';

// Create a new agent
const agent = new SwarmAgentSDK({
  name: 'TwoMessageAgent',
  description: 'An agent that sends two messages before returning a task result',
  capabilities: ['execute'],
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true
});

// Register a task handler
agent.onTask(async (taskData: any, message: TaskExecuteMessage) => {
  console.log('Received task:', taskData);
  const taskId = message.content?.taskId || '';
  
  if (!taskId) {
    console.error('No taskId found in message');
    return { error: 'No taskId found in message' };
  }
  
  try {
    // Send first message
    console.log(`Sending first message for task ${taskId}`);
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: 'This is message 1 of 2',
      data: { progress: 50 }
    });
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send second message
    console.log(`Sending second message for task ${taskId}`);
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: 'This is message 2 of 2',
      data: { progress: 100 }
    });
    
    // Simulate more processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send the task result after the two messages
    // console.log(`Sending task result for task ${taskId}`);
    agent.sendTaskResult(taskId, {
      type: 'agent.task.result',
      message: 'Task completed after sending 2 messages',
      timestamp: new Date().toISOString()
    });
    
    // The return value becomes the final result that gets wrapped in a message
    // but the explicit sendTaskResult above will be sent separately
    return {
      response: "Task completed after sending 2 messages",
      messageCount: 2,
      isComplete: true
    };
  } catch (error) {
    console.error(`Error processing task ${taskId}:`, error);
    return { 
      error: `Error processing task: ${error instanceof Error ? error.message : String(error)}`
    };
  }
});

// Listen for events
agent.on('connected', () => {
  console.log('Connected to orchestrator');
});

agent.on('registered', async () => {
  console.log('Agent registered with orchestrator');
});

agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

agent.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Agent started and connected to orchestrator');
  })
  .catch(error => {
    console.error('Connection error:', error.message);
  });

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await agent.disconnect();
  process.exit(0);
}); 