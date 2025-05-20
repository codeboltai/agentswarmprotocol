import { SwarmClientSDK } from "@agentswarmprotocol/clientsdk";
import chalk from "chalk";

// Add global unhandled rejection handler for better debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Configuration for the orchestrator connection
const sdk = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001', // Change this URL if your orchestrator runs elsewhere
  autoReconnect: false // Prevent repeated reconnects during debugging
});

// Set up global result tracking
let taskCompleted = false;
let taskResult: any = null;

sdk.on('connected', () => {
  console.log(chalk.blue.bgGreen.bold('Connected to Orchestrator'));
});

// Listen for errors
sdk.on('error', (err) => {
  console.error(chalk.red('[error]'), err);
});

// Set up event listeners for tasks
sdk.on('task.result', (result) => {
  console.log(chalk.green('Task result received:'), result);
  // Mark task as completed when we get a result
  taskCompleted = true;
  taskResult = result;
});

sdk.on('task.status', (status) => {
  console.log(chalk.yellow('Task status update:'), status);
  // If we get a completed status with a result, mark as completed
  if (status.status === 'completed' && status.result) {
    console.log(chalk.green('Task completed via status update'));
    taskCompleted = true;
    taskResult = status;
  }
});

sdk.on('task.notification', (notification) => {
  console.log(chalk.blue('Task notification:'), notification);
});

// Enable raw message debugging for troubleshooting
sdk.on('raw-message', (msg) => {
  console.log(chalk.gray(`[raw:${msg.type}]`), msg.id);
});

async function main() {
  try {
    // Connect to the orchestrator
    await sdk.connect();
    console.log('Connected to orchestrator!');

    // Fetch the list of available agents
    const agents = await sdk.getAgentsList();
    console.log('Available agents:', agents.length);

    if (agents.length === 0) {
      console.log('No agents available to send a task.');
      return;
    }

    // Choose the first agent
    const agent = agents[0];
    console.log(`Selected agent: ${agent.name} (${agent.id})`);
    
    // Send a sample task to the agent
    const taskData = { query: 'Hello from baseclient!', taskType: 'execute' };
    
    console.log(`Sending task to agent ${agent.name} (${agent.id})...`);
    
    try {
      // Try with a longer timeout
      const task = await sdk.sendTask(agent.id, agent.name, taskData, {
        timeout: 60000 // 60 second timeout
      });
      
      console.log(chalk.green.bold('Task completed via SDK:'), task);
    } catch (taskError) {
      console.error(chalk.red('Error executing task:'), taskError);
      
      // If we received a result via events but still got a timeout,
      // we can use the result we received
      if (taskCompleted && taskResult) {
        console.log(chalk.yellow('Got task result via events:'), taskResult);
      }
    }
    
    // Wait for a moment before disconnecting
    console.log('Waiting a moment before disconnecting...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    console.error('Error in client:', error);
  } finally {
    // Disconnect from the orchestrator
    console.log('Disconnecting from orchestrator...');
    sdk.disconnect();
  }
}

main();
