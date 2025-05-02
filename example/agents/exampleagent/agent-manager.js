/**
 * Example Agent Manager - Demonstrates agent-to-agent communication capabilities
 * This agent can discover other agents and delegate tasks to them
 */

const { SwarmAgentSDK } = require('../../sdk/agentsdk');

// Create the manager agent instance
const managerAgent = new SwarmAgentSDK({
  name: 'Agent Manager',
  description: 'Manages and coordinates other agents in the swarm',
  agentType: 'manager',
  capabilities: ['agent-discovery', 'task-delegation'],
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
});

// Connect to the orchestrator
managerAgent.connect()
  .then(() => {
    console.log('Agent Manager connected to orchestrator');
  })
  .catch((error) => {
    console.error('Failed to connect Agent Manager:', error.message);
  });

// Listen for various events
managerAgent.on('connected', () => {
  console.log('Agent Manager connected');
});

managerAgent.on('disconnected', () => {
  console.log('Agent Manager disconnected');
});

managerAgent.on('error', (error) => {
  console.error('Agent Manager error:', error.message);
});

// Handle requests to list available agents
managerAgent.onAgentRequest('list-agents', async (taskData, metadata) => {
  console.log('Handling request to list agents');
  
  try {
    // Get list of agents from orchestrator
    const agents = await managerAgent.getAgentList(taskData.filters || {});
    
    return {
      agents,
      count: agents.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error listing agents:', error.message);
    return {
      error: error.message
    };
  }
});

// Handle requests to delegate a task to another agent
managerAgent.onAgentRequest('delegate-task', async (taskData, metadata) => {
  console.log('Handling request to delegate task');
  
  const { targetAgent, taskType, taskParams } = taskData;
  
  if (!targetAgent) {
    return { error: 'Target agent is required' };
  }
  
  if (!taskType) {
    return { error: 'Task type is required' };
  }
  
  try {
    // Request the target agent to perform the task
    const result = await managerAgent.executeAgentTask(
      targetAgent,
      taskType,
      taskParams || {}
    );
    
    return {
      status: 'success',
      result,
      delegatedTo: targetAgent,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error delegating task to ${targetAgent}:`, error.message);
    return {
      error: error.message,
      status: 'failed'
    };
  }
});

// Export the agent instance
module.exports = managerAgent; 