import { SwarmClientSDK } from "@agentswarmprotocol/clientsdk";
import chalk from "chalk";

// Add global unhandled rejection handler for better debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Configuration for the orchestrator connection
const sdk = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001', // Client server port (orchestrator runs on 3000, client server on 3001)
  autoReconnect: false // Prevent repeated reconnects during debugging
});

// Set up global result tracking
let taskCompleted = false;
let taskResult: any = null;

sdk.on('connected', () => {
  console.log(chalk.blue.bgGreen.bold('✅ Connected to Orchestrator'));
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
    console.log(chalk.blue.bold('🚀 Starting BaseClient - Agent Swarm Protocol Test Client'));
    console.log(chalk.blue('This client will specifically target BaseAgent for task delegation testing.'));
    
    // Connect to the orchestrator
    await sdk.connect();
    console.log(chalk.green('✅ Connected to orchestrator!'));

    // Fetch the list of available agents
    const agents = await sdk.getAgentsList();
    console.log(chalk.blue(`📋 Available agents total: ${agents.length}`));

    // Filter only online agents
    const onlineAgents = agents.filter(agent => agent.status === 'online');
    console.log(chalk.blue(`🟢 Online agents: ${onlineAgents.length}`));

    if (onlineAgents.length === 0) {
      console.log(chalk.red('❌ No online agents available to send a task.'));
      return;
    }

    // Look for BaseAgent specifically
    const baseAgent = onlineAgents.find(agent => agent.name === 'BaseAgent');
    
    if (!baseAgent) {
      console.log(chalk.red('❌ BaseAgent not found among online agents.'));
      console.log(chalk.yellow('📋 Available online agents:'));
      onlineAgents.forEach(agent => {
        console.log(chalk.yellow(`  - ${agent.name} (${agent.id}) - Status: ${agent.status}`));
      });
      return;
    }

    const agent = baseAgent;
    console.log(chalk.green(`🎯 Selected BaseAgent: ${agent.name} (${agent.id}) - Status: ${agent.status}`));
    
    // Define different types of tasks to test delegation functionality
    const testTasks = [
      {
        name: 'Echo Task (will be delegated to ChildAgent)',
        data: { 
          taskType: 'echo', 
          message: 'Hello from baseclient! This should be processed by ChildAgent.' 
        }
      },
      // {
      //   name: 'Text Processing Task (will be delegated to ChildAgent)',
      //   data: { 
      //     taskType: 'processText', 
      //     text: 'The Agent Swarm Protocol enables seamless communication between distributed agents in a microservices architecture.' 
      //   }
      // },
      // {
      //   name: 'Calculation Task (will be delegated to ChildAgent)',
      //   data: { 
      //     taskType: 'calculate', 
      //     operation: 'sum', 
      //     numbers: [15, 25, 35, 45, 55] 
      //   }
      // },
      // {
      //   name: 'Custom Task (will be processed locally by BaseAgent)',
      //   data: { 
      //     taskType: 'customProcessing', 
      //     query: 'This is a custom task that should be processed locally by BaseAgent.',
      //     metadata: { source: 'baseclient', timestamp: new Date().toISOString() }
      //   }
      // }
    ];
    
    // Send each task and wait for completion
    for (let i = 0; i < testTasks.length; i++) {
      const testTask = testTasks[i];
      console.log(chalk.cyan(`\n=== Test ${i + 1}/4: ${testTask.name} ===`));
      
      // Reset task completion tracking
      taskCompleted = false;
      taskResult = null;
      
      console.log(`Sending task to BaseAgent (${agent.name})...`);
      console.log('Task data:', JSON.stringify(testTask.data, null, 2));
      
      try {
        // Try with a longer timeout
        const task = await sdk.sendTask(agent.id, agent.name, testTask.data, {
          timeout: 60000 // 60 second timeout
        });
        
        console.log(chalk.green.bold('✅ Task completed via SDK:'), JSON.stringify(task, null, 2));
      } catch (taskError) {
        console.error(chalk.red('❌ Error executing task:'), taskError);
        
        // If we received a result via events but still got a timeout,
        // we can use the result we received
        if (taskCompleted && taskResult) {
          console.log(chalk.yellow('📨 Got task result via events:'), JSON.stringify(taskResult, null, 2));
        }
      }
      
      // Wait between tasks
      if (i < testTasks.length - 1) {
        console.log(chalk.gray('Waiting 3 seconds before next task...'));
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(chalk.green.bold('\n🎉 All tests completed successfully!'));
    
    // Wait for a moment before disconnecting
    console.log(chalk.gray('⏳ Waiting 5 seconds before disconnecting...'));
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    console.error(chalk.red('❌ Error in client:'), error);
  } finally {
    // Disconnect from the orchestrator
    console.log(chalk.blue('👋 Disconnecting from orchestrator...'));
    sdk.disconnect();
    console.log(chalk.blue('✅ Disconnected. Goodbye!'));
  }
}

main();
