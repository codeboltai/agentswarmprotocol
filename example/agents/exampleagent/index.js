/**
 * Example of agent-to-agent communication
 * This script runs both the Agent Manager and Client Agent to demonstrate
 * how agents can discover each other and delegate tasks via the orchestrator.
 */

// Import both agents
const managerAgent = require('./agent-manager');
const clientAgent = require('./client-agent');

console.log('=== Starting Agent-to-Agent Communication Example ===');
console.log('Both agents connecting to orchestrator...');

// The agents will automatically connect and run the demo
// The demo will run after a short delay to allow both agents to connect

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n=== Shutting down agents ===');
  managerAgent.disconnect();
  clientAgent.disconnect();
  
  console.log('Agents disconnected, exiting...');
  process.exit(0);
});

console.log('\nPress Ctrl+C to exit'); 