import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';

// Create a new agent
const agent = new SwarmAgentSDK({
  name: 'TwoMessageAgent',
  description: 'An agent that responds to two messages before finishing the task',
  capabilities: ['execute'],
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true
});

// Keep track of message count
const messageCounters = new Map<string, number>();

// Register a task handler for message responses
agent.onTask(async (taskData: any, message: TaskExecuteMessage) => {
  console.log('Received message task:', taskData);
  const taskId = message.content?.taskId || '';
  

  
  // Initialize counter for this task if it doesn't exist
  if (!messageCounters.has(taskId)) {
    messageCounters.set(taskId, 0);
  }
  
  // Get current count and increment
  const currentCount = messageCounters.get(taskId) || 0;
  messageCounters.set(taskId, currentCount + 1);
  
  // Send first notification
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: `Processing message ${currentCount + 1}/2...`,
    data: { progress: 50 * currentCount }
  });
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate response based on current message count
  let response: string;
  let shouldFinish: boolean = false;
  
  if (currentCount === 0) {
    response = `This is my first response to: "${taskData.query}"`;
  } else {
    response = `This is my second and final response to: "${taskData.query}"`;
    shouldFinish = true;
  }
  
  // Send final notification
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: `Completed message ${currentCount + 1}/2`,
    data: { progress: 50 + 50 * currentCount }
  });
  
  // If this is the second message, clean up the counter
  if (shouldFinish) {
    messageCounters.delete(taskId);
  }
  
  // Return the result
  return {
    response: response,
    messageNumber: currentCount + 1,
    isComplete: shouldFinish
  };
});


// Function to get the list of agents
async function getAgentsList() {
  const agents = await agent.getAgentList();
  console.log('Agents:', agents);
}

// Function to get the list of agents
async function getMCPServerList() {
  const mcpServers = await agent.getMCPServers();
  console.log('MCPServers:', mcpServers);
}


// Function to get and display available services
async function getAvailableServices() {
  try {
    console.log('Fetching available services...');
    const services = await agent.getServiceList();
    console.log('Available services:', services.length);
    
    if (services && services.length > 0) {
      console.log('Available services:');
      services.forEach((service, index) => {
        console.log(`  ${index + 1}. ${service.name} (ID: ${service.id})`);
        console.log(`     Status: ${service.status}`);
        if (service.capabilities && service.capabilities.length > 0) {
          console.log(`     Capabilities: ${service.capabilities.join(', ')}`);
        }
        console.log('');
      });
    } else {
      console.log('No services are currently available.');
    }
  } catch (error) {
    console.error('Error fetching services:', error instanceof Error ? error.message : String(error));
  }
}

// Listen for events
agent.on('connected', () => {
  console.log('Connected to orchestrator');
});

agent.on('registered', async () => {
  console.log('Agent registered with orchestrator');
  
  // Get the list of available services after registration
  // await getAvailableServices();
  // await getMCPServerList();
});

agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

agent.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

// Connect to the orchestrator
agent.connect()
  .then(async () => {
    console.log('Agent started and connected to orchestrator');
    
    // Also get services after connection (in case registration event doesn't fire)
    setTimeout(async () => {
      // await getMCPServerList();
    }, 2000);
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
