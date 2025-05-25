import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';
import { v4 as uuidv4 } from 'uuid';

// Create a new agent
const agent = new SwarmAgentSDK({
  name: 'TwoMessageAgent',
  description: 'An agent that sends two messages before returning a task result',
  capabilities: ['execute'],
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true
});

// Function to get and display service list
async function getAndDisplayServiceList() {
  try {
    console.log('Requesting list of services...');
    const services = await agent.getServiceList();
    console.log('\n=== AVAILABLE SERVICES ===');
    if (services && services.length > 0) {
      services.forEach((service, index) => {
        console.log(`${index + 1}. Service: ${service.name || service.id}`);
        console.log(`   ID: ${service.id}`);
        console.log(`   Status: ${service.status}`);
        console.log(`   Capabilities: ${service.capabilities ? service.capabilities.join(', ') : 'None'}`);
        console.log('   ---');
      });
    } else {
      console.log('No services are currently available.');
    }
    console.log('=========================\n');
  } catch (error) {
    console.error('Error getting service list:', error instanceof Error ? error.message : String(error));
  }
}

// Function to get and display tools from data-processing-service
async function getAndDisplayDataProcessingTools() {
  try {
    console.log('Requesting tools from data-processing-service...');
    const tools = await agent.getServiceToolList('data-processing-service');
    console.log('\n=== DATA PROCESSING SERVICE TOOLS ===');
    if (tools && tools.length > 0) {
      tools.forEach((tool, index) => {
        console.log(`${index + 1}. Tool: ${tool.name || tool.id}`);
        console.log(`   ID: ${tool.id}`);
        console.log(`   Description: ${tool.description || 'No description'}`);
        if (tool.inputSchema) {
          console.log(`   Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
        }
        console.log('   ---');
      });
    } else {
      console.log('No tools are currently available for data-processing-service.');
    }
    console.log('=====================================\n');
  } catch (error) {
    console.error('Error getting tool list from data-processing-service:', error instanceof Error ? error.message : String(error));
  }
}

// Function to run the textAnalyze tool
async function runTextAnalyzeTool() {
  try {
    console.log('Running textAnalyze tool...');
    const sampleText = "This is a sample text that will be analyzed by the data processing service. It contains multiple sentences and various words. The service will analyze this text and provide detailed metrics about word count, character count, and other useful information.";
    
    console.log(`Sample text: "${sampleText}"`);
    console.log('Executing textAnalyze tool...');
    
    const result = await agent.executeServiceTool(
      'data-processing-service',
      'textAnalyze',
      { text: sampleText },
      { timeout: 30000 }
    );
    
    console.log('\n=== TEXT ANALYSIS RESULT ===');
    console.log('Full result:', JSON.stringify(result, null, 2));
    if (result && result.analysis) {
      console.log('Analysis:', JSON.stringify(result.analysis, null, 2));
      console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    }
    console.log('============================\n');
    
  } catch (error) {
    console.error('Error running textAnalyze tool:', error instanceof Error ? error.message : String(error));
  }
}

// Register a task handler
agent.onTask(async (taskData: any, message: TaskExecuteMessage) => {
  console.log('Received task:', taskData);
  const taskId = message.content?.taskId || '';
  
  if (!taskId) {
    console.error('No taskId found in message');
    return { error: 'No taskId found in message' };
  }
  
  try {
    // Send first message
    console.log(`Sending first message for task ${taskId}`);
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: 'This is message 1 of 2',
      data: { progress: 50 }
    });
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send second message
    console.log(`Sending second message for task ${taskId}`);
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: 'This is message 2 of 2',
      data: { progress: 100 }
    });
    
    // Simulate more processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send the task result after the two messages
    // console.log(`Sending task result for task ${taskId}`);
    agent.sendTaskResult(taskId, {
      type: 'agent.task.result',
      message: 'Task completed after sending 2 messages',
      timestamp: new Date().toISOString()
    });
    
    // The return value becomes the final result that gets wrapped in a message
    // but the explicit sendTaskResult above will be sent separately
    return {
      response: "Task completed after sending 2 messages",
      messageCount: 2,
      isComplete: true
    };
  } catch (error) {
    console.error(`Error processing task ${taskId}:`, error);
    return { 
      error: `Error processing task: ${error instanceof Error ? error.message : String(error)}`
    };
  }
});

// Listen for events
agent.on('connected', () => {
  console.log('Connected to orchestrator');
});

agent.on('registered', async () => {
  console.log('Agent registered with orchestrator');
  
  // Get and display the list of services after registration
  await getAndDisplayServiceList();
  
  // Get and display tools from data-processing-service
  await getAndDisplayDataProcessingTools();
  
  // Run the textAnalyze tool with sample text
  await runTextAnalyzeTool();
});

agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

agent.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Agent started and connected to orchestrator');
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