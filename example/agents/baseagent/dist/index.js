"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_sdk_1 = require("@agent-swarm/agent-sdk");
// Create a new agent
const agent = new agent_sdk_1.SwarmAgentSDK({
    name: 'TwoMessageAgent',
    description: 'An agent that responds to two messages before finishing the task',
    capabilities: ['message-response'],
    orchestratorUrl: 'ws://localhost:3000',
    autoReconnect: true
});
// Keep track of message count
const messageCounters = new Map();
// Register a task handler for message responses
agent.onTask(async (taskData, message) => {
    console.log('Received message task:', taskData);
    const taskId = message.content?.taskId || '';
    // Handle only message-response tasks
    if (message.content?.taskType !== 'message-response') {
        return { error: 'Unsupported task type' };
    }
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
    let response;
    let shouldFinish = false;
    if (currentCount === 0) {
        response = `This is my first response to: "${taskData.message}"`;
    }
    else {
        response = `This is my second and final response to: "${taskData.message}"`;
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
// Listen for events
agent.on('connected', () => {
    console.log('Connected to orchestrator');
});
agent.on('registered', () => {
    console.log('Agent registered with orchestrator');
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
