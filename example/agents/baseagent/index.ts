import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';

// Create a new simple agent
const agent = new SwarmAgentSDK({
  name: 'SimpleAgent',
  description: 'A basic agent that processes text input',
  capabilities: ['text-processing']
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Connected to orchestrator');
  })
  .catch(error => {
    console.error('Error connecting to orchestrator:', error.message);
  });

// Register a task handler for text processing
agent.onMessage('text-processing', async (taskData: any, metadata: any) => {
  console.log('Received text processing task:', taskData);
  
  // Process the text (simple transformation example)
  const processedText = taskData.text.toUpperCase();
  
  // Send task message to update on progress
  agent.sendMessage(metadata.taskId, {
    type: 'progress',
    message: 'Processing text...',
    progress: 50
  });
  
  // Small delay to simulate processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return the result
  return {
    processedText,
    metadata: {
      processedAt: new Date().toISOString(),
      transformationType: 'uppercase'
    }
  };
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
