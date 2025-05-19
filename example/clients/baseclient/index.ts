import { SwarmClientSDK } from "@agentswarmprotocol/clientsdk";

// Add global unhandled rejection handler for better debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Configuration for the orchestrator connection
const sdk = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001' // Change this URL if your orchestrator runs elsewhere
});

async function main() {
  try {
    // Connect to the orchestrator
    await sdk.connect();
    // console.log('Connected to orchestrator!');

    // // Fetch the list of available agents
    const agents = await sdk.getAgentsList();
    console.log('Available agents:', agents);

    if (agents.length === 0) {
      console.log('No agents available to send a task.');
      return;
    }

    // // Send a sample task to the first agent
    const agentName = agents[0].name || agents[0].id || agents[0];
    const taskData = { query: 'Hello from baseclient!' };
    const task = await sdk.sendTask(agentName, taskData);
    console.log('Task created:', task);
  } catch (error) {
    console.error('Error in client:', error);
  } finally {
    sdk.disconnect();
  }
}

main();
