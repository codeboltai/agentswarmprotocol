import { SwarmAgentSDK } from '@agent-swarm/agent-sdk';
import { TaskExecuteMessage } from '@agent-swarm/agent-sdk/dist/core/types';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

// Create a new agent with a consistent agent ID
const agent = new SwarmAgentSDK({
  agentId: 'base-agent-001', // Consistent agent ID for reconnections
  name: 'BaseAgent',
  description: 'A base agent that can delegate tasks to child agents or process them locally',
  capabilities: ['execute', 'delegate', 'coordinate'],
  orchestratorUrl: 'ws://localhost:3000',
  autoReconnect: true
});

// Store MCP servers for later use
let mcpServers: any[] = [];

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

// Function to get and display MCP servers
async function getAndDisplayMCPServers() {
  try {
    console.log(chalk.blue('Requesting list of MCP servers...'));
    const servers = await agent.getMCPServers();
    mcpServers = servers; // Store servers for later use
    console.log('\n'+chalk.blue('=== AVAILABLE MCP SERVERS ==='));
    if (servers && servers.length > 0) {
      servers.forEach((server, index) => {
        console.log(chalk.blue(`${index + 1}. Server: ${server.name || server.id}`));
        console.log(chalk.blue(`   ID: ${server.id}`));
        console.log(chalk.blue(`   Status: ${server.status || 'unknown'}`));
        console.log(chalk.blue(`   Capabilities: ${server.capabilities ? server.capabilities.join(', ') : 'None'}`));
        console.log(chalk.blue('   ---'));
      });
    } else {
      console.log('No MCP servers are currently available.');
    }
    console.log(chalk.blue('==============================\n'));
  } catch (error) {
    console.error('Error getting MCP server list:', error instanceof Error ? error.message : String(error));
  }
}

// Function to find filesystem MCP server ID
function getFilesystemServerId(): string | null {
  const filesystemServer = mcpServers.find(server => 
    server.name && server.name.toLowerCase().includes('filesystem')
  );
  return filesystemServer ? filesystemServer.id : null;
}

// Function to get and display tools from filesystem MCP server
async function getAndDisplayFilesystemTools() {
  try {
    const serverId = getFilesystemServerId();
    if (!serverId) {
      console.log('No filesystem MCP server found.');
      return;
    }

    console.log(chalk.gray(`Requesting tools from filesystem MCP server (ID: ${serverId})...`));
    const tools = await agent.getMCPTools(serverId);
    console.log('\n'+chalk.gray('=== FILESYSTEM MCP TOOLS ==='));
    if (tools && tools.length > 0) {
      tools.forEach((tool, index) => {
        console.log(chalk.gray(`${index + 1}. Tool: ${tool.name || tool.id}`));
        console.log(chalk.gray(`   Description: ${tool.description || 'No description'}`));
        if (tool.inputSchema) {
          console.log(chalk.gray(`   Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`));
        }
        console.log(chalk.gray('   ---'));
      });
    } else {
      console.log(chalk.gray('No tools are currently available for filesystem MCP server.'));
    }
    console.log(chalk.gray('=============================\n'));
  } catch (error) {
    console.error('Error getting filesystem MCP tools:', error instanceof Error ? error.message : String(error));
  }
}

// Function to list files using filesystem MCP server
async function listFilesWithMCP() {
  try {
    const serverId = getFilesystemServerId();
    if (!serverId) {
      console.log('No filesystem MCP server found.');
      return;
    }
    console.log(chalk.green(`Listing files using filesystem MCP server (ID: ${serverId})...`));
    
    // Try to list files in the current directory
    const result = await agent.executeMCPTool(
      serverId,
      'list_directory',
      { path: '.' },
      30000
    );
    
    console.log(chalk.green('\n=== FILESYSTEM LISTING RESULT ==='));
    console.log(chalk.green('Full result:'), chalk.green(JSON.stringify(result, null, 2)));
    
    console.log(chalk.green('==================================\n'));
    
  } catch (error) {
    console.error('Error listing files with MCP:', error instanceof Error ? error.message : String(error));
  }
}

// Store pending requests to correlate with responses
const pendingRequests = new Map();

// Function to test child agent delegation
async function testChildAgentDelegation() {
  try {
    console.log(chalk.magenta('\n=== TESTING CHILD AGENT DELEGATION ==='));
    
    // Test 1: Echo task using event-based approach
    console.log(chalk.magenta('Test 1: Sending echo task to ChildAgent...'));
    
    // Create a promise that resolves when we get the response
    const echoPromise = new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      pendingRequests.set(requestId, { resolve, reject, taskType: 'echo' });
      
      // Set a timeout
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Timeout waiting for child agent response'));
        }
      }, 10000);
      
      // Store the request ID for correlation
      pendingRequests.set('latest', requestId);
      
      // Send the task (don't await the SDK result, just trigger the request)
      agent.executeChildAgentTask('ChildAgent', {
        taskType: 'echo',
        message: 'Hello from BaseAgent! This is a test message.'
      }).catch(err => {
        console.log(chalk.yellow('SDK method failed, but we\'ll wait for event response:', err.message));
      });
    });
    
    // Wait for our event-based result
    const echoResult = await echoPromise;
    
    console.log(chalk.magenta('Echo result:'), JSON.stringify(echoResult, null, 2));
    console.log(chalk.magenta('Echo result type:'), typeof echoResult);
    console.log(chalk.magenta('Echo result keys:'), echoResult ? Object.keys(echoResult) : 'No keys (null/undefined)');
    
    // Extract the actual echo message from the nested result structure
    const actualEcho = (echoResult as any)?.result?.result?.echo || (echoResult as any)?.result?.echo || (echoResult as any)?.echo;
    console.log(chalk.magenta('Extracted echo message:'), actualEcho);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Text processing task
    console.log(chalk.magenta('Test 2: Sending text processing task to ChildAgent...'));
    const textResult = await agent.executeChildAgentTask('ChildAgent', {
      taskType: 'processText',
      text: 'The Agent Swarm Protocol enables seamless communication between multiple agents in a distributed system.'
    });
    console.log(chalk.magenta('Text processing result:'), JSON.stringify(textResult, null, 2));
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Calculation task
    console.log(chalk.magenta('Test 3: Sending calculation task to ChildAgent...'));
    const calcResult = await agent.executeChildAgentTask('ChildAgent', {
      taskType: 'calculate',
      operation: 'sum',
      numbers: [10, 20, 30, 40, 50]
    });
    console.log(chalk.magenta('Calculation result:'), JSON.stringify(calcResult, null, 2));
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 4: Data analysis task
    console.log(chalk.magenta('Test 4: Sending data analysis task to ChildAgent...'));
    const dataResult = await agent.executeChildAgentTask('ChildAgent', {
      taskType: 'analyzeData',
      dataset: ['apple', 'banana', 'cherry', 42, true, null, 'grape']
    });
    console.log(chalk.magenta('Data analysis result:'), JSON.stringify(dataResult, null, 2));
    
    console.log(chalk.magenta('=== ALL CHILD AGENT TESTS COMPLETED ===\n'));
    
  } catch (error) {
    console.error(chalk.red('Error testing child agent delegation:'), error instanceof Error ? error.message : String(error));
  }
}

// Function to determine if a task should be delegated to a child agent
function shouldDelegateToChild(taskType: string, taskData: any): boolean {
  // Delegate specific task types to child agent
  const delegatableTypes = ['processText', 'calculate', 'analyzeData', 'echo'];
  return delegatableTypes.includes(taskType);
}

// Function to process tasks locally (original behavior)
async function processTaskLocally(taskId: string, taskData: any, taskType: string) {
  console.log(chalk.green(`🔧 Processing ${taskType} task locally...`));
  
  // Send first message
  console.log(`Sending first message for task ${taskId}`);
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: 'This is message 1 of 2 - BaseAgent processing locally',
    data: { progress: 50 }
  });
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Send second message
  console.log(`Sending second message for task ${taskId}`);
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: 'This is message 2 of 2 - BaseAgent processing locally',
    data: { progress: 100 }
  });
  
  // Simulate more processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send the task result after the two messages
  agent.sendTaskResult(taskId, {
    type: 'agent.task.result',
    message: 'Task completed locally by BaseAgent after sending 2 messages',
    processedBy: 'BaseAgent',
    taskType,
    timestamp: new Date().toISOString()
  });
  
  // The return value becomes the final result that gets wrapped in a message
  return {
    response: "Task completed locally by BaseAgent after sending 2 messages",
    messageCount: 2,
    processedBy: 'BaseAgent',
    taskType,
    isComplete: true
  };
}

// Register a task handler
agent.onTask(async (taskData: any, message: TaskExecuteMessage) => {
  console.log(chalk.blue('📋 BaseAgent received task:'), taskData);
  const taskId = message.content?.taskId || '';
  const taskType = taskData?.taskType || taskData?.type || 'default';
  
  if (!taskId) {
    console.error('No taskId found in message');
    return { error: 'No taskId found in message' };
  }
  
  try {
    // Check if this task should be delegated to a child agent
    if (shouldDelegateToChild(taskType, taskData)) {
      console.log(chalk.yellow(`🔄 Delegating ${taskType} task to ChildAgent...`));
      
      // Send progress message
      agent.sendTaskMessage(taskId, {
        type: 'progress',
        message: `BaseAgent delegating ${taskType} task to ChildAgent`,
        data: { progress: 25, status: 'delegating' }
      });
      
      try {
        // Delegate to child agent
        const childResult = await agent.executeChildAgentTask('ChildAgent', taskData);
        
        // Send progress message
        agent.sendTaskMessage(taskId, {
          type: 'progress',
          message: `ChildAgent completed ${taskType} task`,
          data: { progress: 100, status: 'completed' }
        });
        
        // Send the task result
        agent.sendTaskResult(taskId, {
          type: 'delegated.task.result',
          message: `Task delegated to ChildAgent and completed successfully`,
          delegatedTo: 'ChildAgent',
          childResult,
          timestamp: new Date().toISOString()
        });
        
        return {
          response: "Task delegated to ChildAgent and completed successfully",
          delegatedTo: 'ChildAgent',
          childResult,
          isComplete: true
        };
      } catch (delegationError) {
        console.error(chalk.red(`❌ Error delegating to ChildAgent:`), delegationError);
        
        // Fall back to processing locally
        console.log(chalk.yellow('⚠️  Falling back to local processing...'));
        return await processTaskLocally(taskId, taskData, taskType);
      }
    } else {
      // Process task locally
      return await processTaskLocally(taskId, taskData, taskType);
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error processing task ${taskId}:`), error);

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
  // await getAndDisplayServiceList();
  
  // // Get and display tools from data-processing-service
  // await getAndDisplayDataProcessingTools();
  
  // // Run the textAnalyze tool with sample text
  // await runTextAnalyzeTool();
  
  // // Get and display MCP servers
  // await getAndDisplayMCPServers();
  
  // // Get and display filesystem tools
  // await getAndDisplayFilesystemTools();
  
  // // List files using filesystem MCP server
  // await listFilesWithMCP();
  
  // Test child agent delegation after a short delay
  setTimeout(async () => {
    // await testChildAgentDelegation();
  }, 3000);
});

agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

agent.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

// Listen for child agent responses
agent.on('childagent.response', (response: any) => {
  console.log(chalk.cyan('📨 Received response from child agent:'), JSON.stringify(response, null, 2));
  
  // Check if we have a pending request to resolve
  const latestRequestId = pendingRequests.get('latest');
  if (latestRequestId && pendingRequests.has(latestRequestId)) {
    const { resolve } = pendingRequests.get(latestRequestId);
    pendingRequests.delete(latestRequestId);
    pendingRequests.delete('latest');
    resolve(response);
  }
});

// Listen for agent request accepted events
agent.on('agent-request-accepted', (response: any) => {
  console.log(chalk.green('✅ Child agent request accepted:'), JSON.stringify(response, null, 2));
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