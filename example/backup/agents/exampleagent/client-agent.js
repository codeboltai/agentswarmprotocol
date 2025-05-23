/**
 * Example Client Agent - Demonstrates how to interact with the Agent Manager
 * Can discover other agents and request tasks to be delegated to them
 */

const { SwarmAgentSDK } = require('../../sdk/agentsdk');

// Create the client agent instance
const clientAgent = new SwarmAgentSDK({
  name: 'Client Agent',
  description: 'Demonstrates agent-to-agent communication via Agent Manager',
  agentType: 'client',
  capabilities: ['agent-discovery-client', 'task-delegation-client'],
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
});

// Connect to the orchestrator
clientAgent.connect()
  .then(() => {
    console.log('Client Agent connected to orchestrator');
    
    // After connection, run a demo of agent-to-agent communication
    setTimeout(() => runAgentCommunicationDemo(), 3000);
  })
  .catch((error) => {
    console.error('Failed to connect Client Agent:', error.message);
  });

// Listen for various events
clientAgent.on('connected', () => {
  console.log('Client Agent connected');
});

clientAgent.on('disconnected', () => {
  console.log('Client Agent disconnected');
});

clientAgent.on('error', (error) => {
  console.error('Client Agent error:', error.message);
});

// Handle any text processing tasks
clientAgent.onAgentRequest('process-text', async (taskData, metadata) => {
  console.log('Handling text processing task');
  
  if (!taskData.text) {
    return { error: 'No text provided for processing' };
  }
  
  const text = taskData.text;
  
  return {
    original: text,
    processed: text.toUpperCase(),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    characterCount: text.length,
    timestamp: new Date().toISOString()
  };
});

/**
 * Demonstrate agent-to-agent communication
 */
async function runAgentCommunicationDemo() {
  console.log('\n=== Running Agent Communication Demo ===\n');
  
  try {
    // Step 1: Request Agent Manager to get a list of available agents
    console.log('1. Requesting list of agents from Agent Manager...');
    const agentListResult = await clientAgent.executeAgentTask(
      'Agent Manager',  // Name of the target agent
      'list-agents',    // Task type
      { filters: { status: 'online' } }  // Task parameters
    );
    
    if (agentListResult.error) {
      throw new Error(`Failed to get agent list: ${agentListResult.error}`);
    }
    
    console.log(`Retrieved ${agentListResult.count} agents:`);
    agentListResult.agents.forEach(agent => {
      console.log(`- ${agent.name} (${agent.capabilities.join(', ')})`);
    });
    
    // Step 2: Find a text processing agent or use ourselves as fallback
    const textProcessingAgents = agentListResult.agents.filter(
      agent => agent.name !== 'Client Agent' && agent.name !== 'Agent Manager'
    );
    
    let targetAgent = 'Client Agent'; // Fallback to self
    
    if (textProcessingAgents.length > 0) {
      targetAgent = textProcessingAgents[0].name;
      console.log(`\n2. Found agent to delegate task to: ${targetAgent}`);
    } else {
      console.log('\n2. No other agents found, will process text ourselves');
    }
    
    // Step 3: Process text either directly or via Agent Manager delegation
    const textToProcess = "Hello, this is a test of agent-to-agent communication.";
    
    if (targetAgent !== 'Client Agent') {
      console.log('\n3. Delegating text processing task via Agent Manager...');
      
      const delegationResult = await clientAgent.executeAgentTask(
        'Agent Manager',
        'delegate-task',
        {
          targetAgent: targetAgent,
          taskType: 'process-text',
          taskParams: { text: textToProcess }
        }
      );
      
      if (delegationResult.error) {
        throw new Error(`Task delegation failed: ${delegationResult.error}`);
      }
      
      console.log('Task delegation successful:');
      console.log('- Status:', delegationResult.status);
      console.log('- Delegated to:', delegationResult.delegatedTo);
      console.log('- Result:', JSON.stringify(delegationResult.result, null, 2));
    } else {
      // Process directly if no other agents available
      console.log('\n3. Processing text directly (no delegation)...');
      
      const taskResult = await processTextLocally(textToProcess);
      console.log('Processing result:', JSON.stringify(taskResult, null, 2));
    }
    
    console.log('\n=== Agent Communication Demo Completed ===\n');
  } catch (error) {
    console.error('Error in agent communication demo:', error.message);
  }
}

/**
 * Process text locally as a fallback
 * @param {string} text - The text to process
 * @returns {Object} - Processing result
 */
async function processTextLocally(text) {
  return {
    original: text,
    processed: text.toUpperCase(),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    characterCount: text.length,
    timestamp: new Date().toISOString()
  };
}

// Export the agent instance
module.exports = clientAgent; 