import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';

// Create a new simple agent
const agent = new SwarmAgentSDK({
  name: 'SimpleAgent',
  description: 'A basic agent that processes text input',
  capabilities: ['text-processing'],
  orchestratorUrl : 'ws://localhost:3000/'
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
agent.on('task.create', (task) => {
    console.log(`Received task: ${JSON.stringify(task)}`);
    console.log(`Task structure: ${JSON.stringify({
      type: typeof task,
      keys: typeof task === 'object' ? Object.keys(task) : 'n/a',
      hasTaskType: task && task.taskType ? true : false,
      hasQuery: task && task.query ? true : false,
      hasMessage: task && task.message ? true : false
    })}`);
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
