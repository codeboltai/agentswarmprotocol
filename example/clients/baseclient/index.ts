import { SwarmClientSDK } from "@agentswarmprotocol/clientsdk";
import chalk from "chalk";

// Add global unhandled rejection handler for better debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Configuration for the orchestrator connection
const sdk = new SwarmClientSDK({
  orchestratorUrl: 'ws://100.95.18.39:3001', // Change this URL if your orchestrator runs elsewhere
  autoReconnect: false // Prevent repeated reconnects during debugging
});

sdk.on('connected', () => {
  console.log(chalk.blue.bgRed.bold('Hello Orchestrator'));
});

// // Listen for all raw messages
// sdk.on('raw-message', (msg) => {
//   console.log('[raw-message]', msg);
// });

// // Listen for specific events
// sdk.on('welcome', (content) => {
//   console.log('[welcome]', content);
// });
// sdk.on('agent.list', (agents) => {
//   console.log('[agent-list]', agents);
// });
// sdk.on('error', (err) => {
//   console.error('[error]', err);
// });

async function main() {
  try {
    // Connect to the orchestrator
    await sdk.connect();
    console.log('Connected to orchestrator!');

    // Fetch the list of available agents
    const agents = await sdk.getAgentsList();
    console.log('Available agents:', agents);

    if (agents.length === 0) {
      console.log('No agents available to send a task.');
      return;
    }

    // Send a sample task to the first agent
    const taskData = { query: 'Hello from baseclient!' };
    const task = await sdk.sendTask(agents[0].id, agents[0].name , taskData);
    console.log('Task created:', task);
  } catch (error) {
    console.error('Error in client:', error);
  } finally {
    // sdk.disconnect();
  }
}

main();
