const SwarmAgentSDK = require('../../sdk/agentsdk');
const { v4: uuidv4 } = require('uuid');

// Initialize the agent with configuration
const agent = new SwarmAgentSDK({
    name: process.env.AGENT_NAME || 'Simplified Agent',
    orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
    autoReconnect: true,
    capabilities: [
      'chat',
      'contextual-responses',
      'memory',
      'preference-adaptation',
      'mcp-integration',  // MCP integration capability
      'service-integration' // Service integration capability
    ],
    description: 'Conversational agent with memory, context awareness, MCP and service integration',
});

// Define conversation storage
const conversations = new Map();

// MCP cache for storing server and tools information
const mcpCache = {
  servers: null,
  tools: {},
  lastRefresh: 0,
  refreshInterval: 60000 // 1 minute
};

// Service cache for storing service information
const serviceCache = {
  services: null,
  lastRefresh: 0,
  refreshInterval: 60000 // 1 minute
};

// Helper utilities

/**
 * Format duration in a human-readable format
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(durationMs) {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Generate a greeting message based on context
 * @param {string} conversationId - Conversation ID
 * @param {Object} context - Conversation context
 * @returns {string} - Greeting message
 */
function generateGreeting(conversationId, context) {
  const timeOfDay = new Date().getHours();
  let greeting = '';
  
  if (timeOfDay < 12) greeting = 'Good morning';
  else if (timeOfDay < 18) greeting = 'Good afternoon';
  else greeting = 'Good evening';
  
  // Add user name if available
  if (context.userData && context.userData.name) {
    greeting += `, ${context.userData.name}`;
  }
  
  greeting += '! I\'m your conversation assistant. How can I help you today?';
  
  return greeting;
}

/**
 * Generate a farewell message based on context
 * @param {string} conversationId - Conversation ID
 * @param {Object} context - Conversation context
 * @returns {string} - Farewell message
 */
function generateFarewell(conversationId, context) {
  let farewell = 'Thank you for chatting with me';
  
  // Add user name if available
  if (context.userData && context.userData.name) {
    farewell += `, ${context.userData.name}`;
  }
  
  farewell += '. Have a great day!';
  
  if (context.messageCount > 10) {
    farewell += ' It was a pleasure having such an in-depth conversation with you.';
  }
  
  return farewell;
}

/**
 * Generate a response about agent capabilities
 * @param {Object} context - Conversation context
 * @returns {string} - Capabilities response
 */
function generateCapabilitiesResponse(context) {
  return 'I am a conversational agent. I can chat with you, remember our conversation context, ' +
         'adapt to your preferences, connect with research capabilities, and execute MCP (Model Context Protocol) operations. ' +
         'You can ask me questions, request information, or just have a casual conversation. ' +
         'How can I assist you today?';
}

/**
 * Generate a help response
 * @param {Object} context - Conversation context
 * @returns {string} - Help response
 */
function generateHelpResponse(context) {
  return 'You can talk to me about various topics. If you have questions that require research, ' +
         'I can collaborate with a Research Agent to get you answers. ' +
         'You can also tell me your preferences for how verbose or formal you\'d like me to be. ' +
         'What would you like to talk about?';
}

/**
 * Detect intents from user message
 * @param {string} message - User message
 * @returns {Array} - Detected intents
 */
function detectIntents(message) {
  const intents = [];
  const lowerMessage = message.toLowerCase();
  
  // Simple rule-based intent detection
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.match(/^(hey|greetings).*/)) {
    intents.push('greeting');
  }
  
  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
    intents.push('farewell');
  }
  
  if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
    intents.push('help');
  }
  
  if (lowerMessage.includes('capabilities') || lowerMessage.includes('features')) {
    intents.push('capabilities');
  }
  
  if (lowerMessage.includes('prefer') || lowerMessage.includes('concise') || 
      lowerMessage.includes('detailed') || lowerMessage.includes('formal') || 
      lowerMessage.includes('casual')) {
    intents.push('preference_change');
  }
  
  if (lowerMessage.endsWith('?') || lowerMessage.includes('who') || 
      lowerMessage.includes('what') || lowerMessage.includes('where') || 
      lowerMessage.includes('when') || lowerMessage.includes('why') || 
      lowerMessage.includes('how')) {
    intents.push('question');
  }
  
  if (lowerMessage.includes('research') || lowerMessage.includes('find information') || 
      lowerMessage.includes('look up') || lowerMessage.includes('search for')) {
    intents.push('research');
  }
  
  // Detect MCP related intents
  if (lowerMessage.includes('mcp') || lowerMessage.includes('model context protocol') ||
      lowerMessage.includes('tool') || lowerMessage.includes('tools') ||
      lowerMessage.includes('execute') || lowerMessage.includes('run')) {
    intents.push('mcp');
  }
  
  // Detect service-related intents
  if (lowerMessage.includes('service') || lowerMessage.includes('services') ||
      lowerMessage.includes('execute service') || lowerMessage.includes('run service')) {
    intents.push('service');
  }
  
  return intents;
}

/**
 * Analyze sentiment from user message
 * @param {string} message - User message
 * @returns {string} - Detected sentiment
 */
function analyzeSentiment(message) {
  const lowerMessage = message.toLowerCase();
  
  // Simple rule-based sentiment analysis
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'happy', 'glad', 'pleased', 'love', 'like', 'enjoy', 'thanks', 'thank'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'sad', 'unhappy',
    'disappointed', 'hate', 'dislike', 'annoyed', 'angry', 'upset', 'not'
  ];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    if (lowerMessage.includes(word)) {
      positiveScore++;
    }
  });
  
  negativeWords.forEach(word => {
    if (lowerMessage.includes(word)) {
      negativeScore++;
    }
  });
  
  if (positiveScore > negativeScore) {
    return 'positive';
  } else if (negativeScore > positiveScore) {
    return 'negative';
  } else {
    return 'neutral';
  }
}

/**
 * Check if a message is a research query
 * @param {string} message - User message
 * @returns {boolean} - Whether the message is a research query
 */
function isResearchQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for explicit research indicators
  if (lowerMessage.includes('research') || 
      lowerMessage.includes('find information') ||
      lowerMessage.includes('look up') ||
      lowerMessage.includes('search for')) {
    return true;
  }
  
  // Check for question patterns that often require research
  if ((lowerMessage.includes('what is') || 
       lowerMessage.includes('who is') ||
       lowerMessage.includes('how does') ||
       lowerMessage.includes('why is')) &&
       lowerMessage.endsWith('?')) {
    return true;
  }
  
  return false;
}

/**
 * Handle a message about changing preferences
 * @param {string} message - User message
 * @param {Object} context - Conversation context
 * @param {Object} contextUpdates - Updates to context
 * @returns {string} - Response
 */
function handlePreferenceChange(message, context, contextUpdates) {
  // Extract preferences from message
  if (message.toLowerCase().includes('concise') || message.toLowerCase().includes('shorter')) {
    context.preferences.verbosity = 'concise';
    contextUpdates.preferences = { verbosity: 'concise' };
    return 'I\'ll keep my responses more concise from now on.';
  } 
  else if (message.toLowerCase().includes('detailed') || message.toLowerCase().includes('longer')) {
    context.preferences.verbosity = 'detailed';
    contextUpdates.preferences = { verbosity: 'detailed' };
    return 'I\'ll provide more detailed responses from now on.';
  }
  else if (message.toLowerCase().includes('formal')) {
    context.preferences.formality = 'formal';
    contextUpdates.preferences = { formality: 'formal' };
    return 'I\'ll maintain a more formal tone in our conversation moving forward.';
  }
  else if (message.toLowerCase().includes('casual') || message.toLowerCase().includes('informal')) {
    context.preferences.formality = 'casual';
    contextUpdates.preferences = { formality: 'casual' };
    return 'I\'ll keep things casual from now on.';
  }
  
  return 'I\'m not sure which preference you want to change. You can ask for more concise or detailed responses, or request a more formal or casual tone.';
}

/**
 * Adjust response verbosity based on user preference
 * @param {string} response - Original response
 * @param {string} verbosity - Verbosity preference
 * @returns {string} - Adjusted response
 */
function adjustResponseVerbosity(response, verbosity) {
  if (verbosity === 'concise') {
    // Simplify response for concise preference
    return response.split('. ').slice(0, 1).join('. ');
  } 
  else if (verbosity === 'detailed') {
    // Add more details for detailed preference
    return response + ' Is there anything else you would like to know about this?';
  }
  
  // Return original for balanced verbosity
  return response;
}

/**
 * Generate a generic response
 * @param {string} message - User message
 * @param {Object} context - Conversation context
 * @returns {string} - Generic response
 */
function generateGenericResponse(message, context) {
  // In a real implementation, this would use an AI model
  // Here we'll just use some simple patterns
  
  if (message.toLowerCase().includes('mcp')) {
    return 'I can help you with MCP operations. You can ask me to list available MCP servers, show tools on a server, or execute tools.';
  }
  
  if (message.endsWith('?')) {
    return 'That\'s an interesting question. In a real implementation, I would use an AI model to generate a thoughtful response based on our conversation history.';
  }
  
  const responses = [
    'I understand. Tell me more about that.',
    'That\'s interesting. How does that make you feel?',
    'I see. What else would you like to discuss?',
    'Thanks for sharing that with me. What would you like to talk about next?',
    'I appreciate your perspective. Is there anything else on your mind?'
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Generate suggested actions based on conversation
 * @param {string} message - User message
 * @param {Object} context - Conversation context
 * @param {Array} intents - Detected intents
 * @returns {Array} - Suggested actions
 */
function generateSuggestedActions(message, context, intents) {
  const suggestions = [];
  
  // Add different suggestions based on context
  if (context.messageCount <= 2) {
    suggestions.push({
      type: 'suggestion',
      label: 'What can you do?',
      value: 'tell_me_about_capabilities'
    });
  }
  
  if (intents.includes('research') || intents.includes('question')) {
    suggestions.push({
      type: 'suggestion',
      label: 'Find more information',
      value: 'research_this_topic'
    });
  }
  
  if (intents.includes('mcp')) {
    suggestions.push({
      type: 'suggestion',
      label: 'List MCP servers',
      value: 'list_mcp_servers'
    });
  }
  
  if (context.messageCount > 5) {
    suggestions.push({
      type: 'suggestion',
      label: 'End conversation',
      value: 'end_conversation'
    });
  }
  
  return suggestions;
}

/**
 * Format research response from a research agent
 * @param {Object} researchResult - Research results
 * @param {Object} context - Conversation context
 * @returns {string} - Formatted research response
 */
function formatResearchResponse(researchResult, context) {
  if (!researchResult || researchResult.error) {
    return "I tried to research that, but couldn't find any relevant information. " +
           "Would you like to try a different question?";
  }
  
  let response = "Here's what I found based on your query:\n\n";
  
  if (researchResult.summary) {
    response += researchResult.summary;
  } else if (researchResult.results && Array.isArray(researchResult.results)) {
    // Format results into a readable response
    researchResult.results.forEach((item, index) => {
      response += `${index + 1}. ${item.title || 'Result'}: ${item.snippet || item.description || 'No details available'}\n`;
    });
  } else if (researchResult.query && researchResult.sources) {
    // Format source-based research results
    response += `Query: "${researchResult.query}"\n\n`;
    
    researchResult.sources.forEach(source => {
      response += `From ${source.source} (${source.resultCount} results):\n`;
      
      if (source.results && Array.isArray(source.results)) {
        source.results.forEach((result, index) => {
          response += `${index + 1}. ${result.title}: ${result.snippet}\n`;
        });
      }
      
      response += '\n';
    });
  } else {
    // Generic fallback if the format is unknown
    response += JSON.stringify(researchResult);
  }
  
  return response;
}

/**
 * Generate a response to a user message
 * @param {string} conversationId - Conversation ID
 * @param {string} message - User message
 * @param {Object} context - Conversation context
 * @param {Array} intents - Detected intents
 * @param {string} sentiment - Detected sentiment
 * @param {Object} researchResult - Research results if available
 * @param {Object} mcpResult - MCP results if available
 * @returns {Object} - Response data object
 */
function generateResponse(conversationId, message, context, intents, sentiment, researchResult = null, mcpResult = null) {
  // Initialize contextUpdates for tracking changes
  const contextUpdates = {};
  
  // Initialize response data
  const responseData = {
    conversationId,
    intents,
    sentiment,
    contextUpdates
  };
  
  let response = '';
  
  // Handle different intents
  if (intents.includes('greeting')) {
    response = generateGreeting(conversationId, context);
  }
  else if (intents.includes('farewell')) {
    response = generateFarewell(conversationId, context);
  }
  else if (intents.includes('help') || intents.includes('capabilities')) {
    response = generateCapabilitiesResponse(context);
  }
  else if (intents.includes('preference_change')) {
    response = handlePreferenceChange(message, context, contextUpdates);
  }
  else if (mcpResult && mcpResult.formattedResponse) {
    response = mcpResult.formattedResponse;
  }
  else if (researchResult) {
    response = formatResearchResponse(researchResult, context);
  }
  else {
    // Generate a generic response
    response = generateGenericResponse(message, context);
  }
  
  // Adjust response based on user preferences
  if (context.preferences) {
    if (context.preferences.verbosity) {
      response = adjustResponseVerbosity(response, context.preferences.verbosity);
    }
  }
  
  responseData.response = response;
  
  // Add suggested actions based on conversation flow
  responseData.suggestedActions = generateSuggestedActions(message, context, intents);
  
  return responseData;
}

/**
 * Get a list of available MCP servers
 * @returns {Promise<Array>} - List of available MCP servers
 */
async function getMCPServers() {
  // Check cache first
  const now = Date.now();
  if (mcpCache.servers && (now - mcpCache.lastRefresh) < mcpCache.refreshInterval) {
    return mcpCache.servers;
  }

  try {
    // Look at the registered MCP server in orchestrator by directly using the agent list
    const result = await agent.requestService('agent-list', {
      filters: {
        type: 'mcp'
      }
    });
    
    const servers = [];
    if (result && result.agents) {
      result.agents.forEach(agent => {
        servers.push({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          capabilities: agent.capabilities || []
        });
      });
      
      // Update cache
      mcpCache.servers = servers;
      mcpCache.lastRefresh = now;
    }
    
    return mcpCache.servers || [];
  } catch (error) {
    console.error('Error getting MCP servers:', error.message);
    throw error;
  }
}

/**
 * Get a list of tools available on an MCP server
 * @param {string} serverId - MCP server ID
 * @returns {Promise<Array>} - List of available tools
 */
async function getMCPTools(serverId) {
  // Check cache first
  const now = Date.now();
  if (mcpCache.tools[serverId] && (now - mcpCache.lastRefresh) < mcpCache.refreshInterval) {
    return mcpCache.tools[serverId];
  }

  try {
    // For now return hardcoded basic tools until we can properly connect to MCP
    const basicTools = [
      {
        name: "filesystem",
        description: "File system operations",
        capabilities: ["read", "write", "delete"]
      }
    ];
    
    // Update cache
    mcpCache.tools[serverId] = basicTools;
    mcpCache.lastRefresh = now;
    
    return basicTools;
  } catch (error) {
    console.error(`Error getting MCP tools for server ${serverId}:`, error.message);
    throw error;
  }
}

/**
 * Execute an MCP tool
 * @param {string} serverId - MCP server ID
 * @param {string} toolName - Tool name
 * @param {Object} parameters - Tool parameters
 * @returns {Promise<Object>} - Tool execution result
 */
async function executeMCPTool(serverId, toolName, parameters = {}) {
  try {
    // For now, emulate MCP tool execution
    console.log(`Emulating execution of MCP tool ${toolName} on server ${serverId}`);
    console.log(`Parameters: ${JSON.stringify(parameters)}`);
    
    return {
      status: "success",
      result: {
        message: `Tool ${toolName} executed successfully (emulated)`,
        data: {},
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(`Error executing MCP tool ${toolName} on server ${serverId}:`, error.message);
    throw error;
  }
}

/**
 * Execute a service
 * @param {string} serviceName - Service name
 * @param {Object} params - Service parameters
 * @returns {Promise<Object>} - Service execution result
 */
async function executeService(serviceName, params = {}) {
  try {
    // Execute service using the SDK's method
    return await agent.executeService(serviceName, params);
  } catch (error) {
    console.error(`Error executing service ${serviceName}:`, error.message);
    throw error;
  }
}

/**
 * Handle MCP operations task
 * @param {Object} taskData - Task data
 * @returns {Promise<Object>} - Operation result
 */
async function handleMCPOperations(taskData) {
  const { operation, serverId, toolName, parameters } = taskData;
  
  if (!operation) {
    throw new Error('MCP operation is required');
  }
  
  switch (operation) {
    case 'list-servers':
      const servers = await getMCPServers();
      return {
        operation: 'list-servers',
        servers
      };
      
    case 'list-tools':
      if (!serverId) {
        throw new Error('Server ID is required to list tools');
      }
      
      const tools = await getMCPTools(serverId);
      return {
        operation: 'list-tools',
        serverId,
        tools
      };
      
    case 'execute-tool':
      if (!serverId) {
        throw new Error('Server ID is required to execute a tool');
      }
      
      if (!toolName) {
        throw new Error('Tool name is required to execute a tool');
      }
      
      const result = await executeMCPTool(serverId, toolName, parameters || {});
      return {
        operation: 'execute-tool',
        serverId,
        toolName,
        result
      };
      
    case 'execute-service':
      if (!toolName) { // Using toolName as serviceName for consistency
        throw new Error('Service name is required to execute a service');
      }
      
      const serviceResult = await executeService(toolName, parameters || {});
      return {
        operation: 'execute-service',
        serviceName: toolName,
        result: serviceResult
      };
      
    default:
      throw new Error(`Unknown MCP operation: ${operation}`);
  }
}

/**
 * Get a list of available services
 * @returns {Promise<Array>} - List of available services
 */
async function getServices() {
  // Check cache first
  const now = Date.now();
  if (serviceCache.services && (now - serviceCache.lastRefresh) < serviceCache.refreshInterval) {
    return serviceCache.services;
  }

  try {
    // Use direct agent list and filter for services
    const result = await agent.requestService('agent-list', { 
      filters: {} 
    });
    
    const services = [];
    
    // Filter for agents that might act as services
    if (result && result.agents) {
      result.agents.forEach(agent => {
        if (agent.capabilities && (
            agent.capabilities.includes('service') || 
            agent.capabilities.some(cap => cap.includes('service'))
        )) {
          services.push({
            id: agent.id,
            name: agent.name,
            description: agent.description || `Service: ${agent.name}`,
            status: agent.status,
            capabilities: agent.capabilities
          });
        }
      });
      
      // Update cache
      serviceCache.services = services;
      serviceCache.lastRefresh = now;
    }
    
    return serviceCache.services || [];
  } catch (error) {
    console.error('Error getting services:', error.message);
    throw error;
  }
}

// Register event handlers
agent.on('connected', () => {
    console.log('Conversation agent connected to orchestrator');
});

agent.on('registered', (data) => {
    console.log(`Conversation agent registered with ID: ${agent.agentId}`);
    console.log(`Registration details: ${JSON.stringify(data)}`);
});

// Handle conversation start task
agent.onMessage('conversation:start', async (task, metadata) => {
    console.log(`Handling conversation:start task`);
    
    const { conversationId = uuidv4(), context = {} } = task || {};
    
    if (conversations.has(conversationId)) {
        console.warn(`Conversation ${conversationId} already exists, reinitializing`);
    }
    
    // Initialize the conversation context
    const convoContext = {
        startedAt: new Date().toISOString(),
        messageCount: 0,
        history: [],
        userData: context.userData || {},
        preferences: {
            formality: (context.userData?.preferences?.formality) || 'balanced',
            verbosity: (context.userData?.preferences?.verbosity) || 'balanced'
        }
    };
    
    // Store the conversation
    conversations.set(conversationId, convoContext);
    
    console.log(`Started conversation ${conversationId}`);
    
    // Generate greeting based on context
    const greeting = generateGreeting(conversationId, convoContext);
    
    return {
        conversationId,
        response: greeting,
        sentiment: 'positive',
        intents: ['greeting'],
        suggestedActions: [
            {
                type: 'suggestion',
                label: 'Tell me more about what you can do',
                value: 'tell_me_about_capabilities'
            }
        ],
        contextUpdates: {}
    };
});

// Handle conversation message task
agent.onMessage('conversation:message', async (task, metadata) => {
    console.log(`Handling conversation:message task`);
    
    const { conversationId, message, context = {} } = task || {};
    
    if (!conversationId) {
        console.error('Missing required field: conversationId');
        throw new Error('Missing required field: conversationId');
    }
    
    if (!message) {
        console.error('Missing required field: message');
        throw new Error('Missing required field: message');
    }
    
    // Get or create conversation context
    if (!conversations.has(conversationId)) {
        console.warn(`Conversation ${conversationId} not found, initializing`);
        // Handle conversation start internally
        const startTask = { conversationId, context };
        const startResult = await agent.onMessage('conversation:start', startTask, metadata);
    }
    
    const convoContext = conversations.get(conversationId);
    
    // Update userData if provided
    if (context.userData) {
        convoContext.userData = {
            ...convoContext.userData,
            ...context.userData
        };
        
        // Update preferences if provided
        if (context.userData.preferences) {
            convoContext.preferences = {
                ...convoContext.preferences,
                ...context.userData.preferences
            };
        }
    }
    
    // Update message count and history
    convoContext.messageCount++;
    convoContext.history.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    });
    
    // Process the message
    const intents = detectIntents(message);
    const sentiment = analyzeSentiment(message);
    
    // Check if this is a research-related query and available agents are provided
    const isResearchQueryResult = isResearchQuery(message);
    let researchResult = null;
    
    if (isResearchQueryResult && context.availableAgents) {
        const researchAgent = context.availableAgents.find(agent => 
            agent.name === 'Research Agent' || 
            (agent.capabilities && agent.capabilities.includes('research'))
        );
        
        if (researchAgent) {
            console.log(`Detected research query. Forwarding to Research Agent: ${researchAgent.name}`);
            
            try {
                // Use agent-to-agent communication to request research
                researchResult = await agent.requestAgentTask(researchAgent.name, {
                    taskType: 'research:query',
                    query: message,
                    context: {
                        conversationId,
                        originAgent: 'Conversation Agent'
                    }
                });
                
                console.log(`Received research result for query: "${message}"`);
            } catch (error) {
                console.error(`Error requesting research: ${error.message}`);
            }
        }
    }
    
    // Check if this is an MCP-related query
    let mcpResult = null;
    if (intents.includes('mcp')) {
        console.log(`Detected MCP-related query: "${message}"`);
        
        try {
            // Parse the message to determine the MCP operation
            const lowerMessage = message.toLowerCase();
            
            if (lowerMessage.includes('list servers') || lowerMessage.includes('show servers') || 
                (lowerMessage.includes('mcp') && lowerMessage.includes('servers'))) {
                // List MCP servers
                mcpResult = await handleMCPOperations({ operation: 'list-servers' });
                
                // Format the result for user display
                mcpResult.formattedResponse = 'Available MCP servers:\n';
                if (mcpResult.servers && mcpResult.servers.length > 0) {
                    mcpResult.servers.forEach((server, index) => {
                        mcpResult.formattedResponse += `${index + 1}. ${server.name} (${server.id}) - Status: ${server.status}\n`;
                    });
                } else {
                    mcpResult.formattedResponse += 'No MCP servers found.';
                }
            }
            else if (lowerMessage.includes('list tools') || lowerMessage.includes('show tools') || 
                     (lowerMessage.includes('tools') && lowerMessage.includes('server'))) {
                // Try to extract a server name or ID
                let serverId = null;
                
                // Use the first available server if we have them cached
                if (mcpCache.servers && mcpCache.servers.length > 0) {
                    serverId = mcpCache.servers[0].id;
                    
                    // List MCP tools
                    mcpResult = await handleMCPOperations({ 
                        operation: 'list-tools',
                        serverId
                    });
                    
                    // Format the result for user display
                    mcpResult.formattedResponse = `Tools available on ${mcpCache.servers[0].name}:\n`;
                    if (mcpResult.tools && mcpResult.tools.length > 0) {
                        mcpResult.tools.forEach((tool, index) => {
                            mcpResult.formattedResponse += `${index + 1}. ${tool.name}: ${tool.description || 'No description'}\n`;
                        });
                    } else {
                        mcpResult.formattedResponse += 'No tools found on this server.';
                    }
                } else {
                    mcpResult = {
                        formattedResponse: 'I need to know which MCP server you want to list tools for. Please try listing servers first.'
                    };
                }
            }
        } catch (error) {
            console.error(`Error handling MCP query: ${error.message}`);
            mcpResult = {
                error: error.message,
                formattedResponse: `I encountered an error while processing your MCP request: ${error.message}`
            };
        }
    }
    
    // Handle service intent
    if (intents.includes('service')) {
        console.log(`Detected service-related query: "${message}"`);
        
        try {
            const lowerMessage = message.toLowerCase();
            
            if (lowerMessage.includes('list services') || lowerMessage.includes('show services') || 
                (lowerMessage.includes('available') && lowerMessage.includes('services'))) {
                // List services
                const services = await getServices();
                
                // Format the result for user display
                mcpResult = {
                    formattedResponse: 'Available services:\n'
                };
                
                if (services && services.length > 0) {
                    services.forEach((service, index) => {
                        mcpResult.formattedResponse += `${index + 1}. ${service.name} - ${service.description || 'No description'}\n`;
                    });
                } else {
                    mcpResult.formattedResponse += 'No services found.';
                }
            }
            // ... more service handling logic can be added here ...
        } catch (error) {
            console.error('Error handling service query:', error);
            mcpResult = {
                formattedResponse: `Sorry, I encountered an error when processing your service request: ${error.message}`
            };
        }
    }
    
    // Generate a response (with research results if available)
    const responseData = generateResponse(
        conversationId, 
        message, 
        convoContext, 
        intents, 
        sentiment,
        researchResult,
        mcpResult
    );
    
    // Store agent's response in history
    convoContext.history.push({
        role: 'agent',
        content: responseData.response,
        timestamp: new Date().toISOString()
    });
    
    // Update conversation context
    conversations.set(conversationId, convoContext);
    
    return responseData;
});

// Handle conversation end task
agent.onMessage('conversation:end', async (task, metadata) => {
    const { conversationId } = task || {};
    
    if (!conversationId) {
        throw new Error('Missing required field: conversationId');
    }
    
    if (!conversations.has(conversationId)) {
        return {
            error: `Conversation ${conversationId} not found`
        };
    }
    
    const convoContext = conversations.get(conversationId);
    const endedAt = new Date().toISOString();
    const startedAt = new Date(convoContext.startedAt);
    const duration = new Date() - startedAt;
    
    // Generate farewell message
    const farewell = generateFarewell(conversationId, convoContext);
    
    // Create conversation summary
    const summary = {
        conversationId,
        startedAt: convoContext.startedAt,
        endedAt,
        duration: formatDuration(duration),
        messageCount: convoContext.messageCount,
        farewell
    };
    
    // Remove the conversation from active conversations
    conversations.delete(conversationId);
    
    console.log(`Ended conversation ${conversationId} (duration: ${summary.duration})`);
    
    return summary;
});

// Handle simple chat task for backward compatibility
agent.onMessage('chat', async (task, metadata) => {
    console.log('Received legacy chat task, converting to conversation:message format');
    
    const { message, conversationId = uuidv4(), messageHistory = [] } = task;
    
    if (!message) {
        throw new Error('Missing required field: message');
    }
    
    // Check if conversation exists, if not initialize it
    if (!conversations.has(conversationId)) {
        console.log(`Initializing new conversation for legacy chat task: ${conversationId}`);
        const startTask = { 
            conversationId,
            context: {
                userData: {
                    clientId: metadata.clientId || 'unknown',
                    preferences: { formality: 'balanced', verbosity: 'balanced' }
                }
            }
        };
        await agent.onMessage('conversation:start', startTask, metadata);
    }
    
    // Convert to conversation:message format and delegate
    return agent.onMessage('conversation:message', {
        conversationId,
        message,
        context: { messageHistory }
    }, metadata);
});

// Handle MCP operations task
agent.onMessage('mcp:operations', async (taskData, metadata) => {
  console.log(`Handling mcp:operations task`);
  
  try {
    return await handleMCPOperations(taskData);
  } catch (error) {
    console.error(`Error handling MCP operations: ${error.message}`);
    return {
      error: error.message
    };
  }
});

// Additional event listeners for debugging
agent.on('message', (message) => {
  // Log all MCP-related, error messages, and service responses
  if (message.type && (
      message.type.startsWith('mcp.') || 
      message.type.includes('error') || 
      message.type === 'service.response' ||
      message.type.includes('agent.list')
  )) {
    console.log(`DEBUG - Received message of type: ${message.type}`);
    if (message.content && message.content.error) {
      console.log(`DEBUG - Error in message: ${message.content.error}`);
    }
  }
});

agent.on('connected', () => {
  console.log('Agent successfully connected to orchestrator');
});

agent.on('error', (error) => {
  console.error('Agent error:', error.message || error);
  
  // Add specific error detection
  if (error.message) {
    if (error.message.includes('Unsupported message type')) {
      console.error('MESSAGE TYPE ERROR: This might indicate a mismatch between the agent SDK version and the orchestrator.');
      console.error('Suggested fix: Check that both agent SDK and orchestrator are using compatible message types.');
    } else if (error.message.includes('Not found') || error.message.includes('not a function')) {
      console.error('IMPLEMENTATION ERROR: The orchestrator appears to be missing some expected functionality.');
      console.error('Suggested fix: Ensure the orchestrator implementation includes required handlers and services.');
    }
  }
});

agent.on('disconnected', () => {
  console.log('Agent disconnected from orchestrator, will attempt to reconnect if autoReconnect is enabled');
});

// Add specific handlers for MCP errors
agent.on('mcp-error', (error) => {
  console.error('MCP error:', error);
});

// Listen for MCP specific events
agent.on('mcp.servers.list', (content) => {
  console.log(`Received MCP servers list: ${content.servers ? content.servers.length : 0} servers`);
  
  // Update cache
  if (content && content.servers) {
    mcpCache.servers = content.servers;
    mcpCache.lastRefresh = Date.now();
  }
});

agent.on('mcp.tools.list', (content) => {
  console.log(`Received MCP tools list for server ${content.serverId}: ${content.tools ? content.tools.length : 0} tools`);
  
  // Update cache
  if (content && content.serverId && content.tools) {
    mcpCache.tools[content.serverId] = content.tools;
    mcpCache.lastRefresh = Date.now();
  }
});

// Listen for service responses
agent.on('service.response', (content) => {
  console.log(`Received service response: ${JSON.stringify(content)}`);
});

// Connect to the orchestrator and start the agent
(async () => {
    try {
        // Enable more verbose logging if DEBUG environment variable is set
        if (process.env.DEBUG) {
            console.log('Debug mode enabled, showing all messages');
            agent.on('message', (message) => {
                console.log(`DEBUG - Complete message: ${JSON.stringify(message)}`);
            });
        }
        
        console.log('Connecting to orchestrator...');
        await agent.connect();
        console.log('Simplified agent is running...');
        
        // Wait a moment for the agent to fully register
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Initialize MCP servers
        console.log('Initializing MCP integration...');
        let mcpInitialized = false;
        
        try {
            console.log('Attempting to get MCP servers via agent-list service...');
            const servers = await getMCPServers();
            console.log(`Found ${servers.length} MCP servers`);
            
            if (servers && servers.length > 0) {
                mcpInitialized = true;
                
                // Pre-initialize tool knowledge
                try {
                    const firstServerId = servers[0].id;
                    console.log(`Pre-initializing tools for MCP server: ${servers[0].name} (${firstServerId})`);
                    const tools = await getMCPTools(firstServerId);
                    console.log(`Found ${tools.length} tools for MCP server ${firstServerId}`);
                } catch (toolError) {
                    console.warn(`Could not get tools for MCP server: ${toolError.message}`);
                }
            } else {
                console.log('No MCP servers found, will use emulated MCP functionality');
            }
        } catch (mcpError) {
            console.warn('Could not initialize MCP integration:', mcpError.message);
            console.log('Using emulated MCP functionality');
        }
        
        // Initialize services
        console.log('Initializing service integration...');
        let servicesInitialized = false;
        
        try {
            console.log('Attempting to get available services...');
            const services = await getServices();
            console.log(`Found ${services.length} services`);
            
            if (services && services.length > 0) {
                servicesInitialized = true;
            } else {
                console.log('No services found, using default agent capabilities only');
            }
        } catch (serviceError) {
            console.warn('Could not initialize service integration:', serviceError.message);
            console.log('Using default agent capabilities only');
        }
        
        console.log('Agent initialization completed:');
        console.log(`- MCP Integration: ${mcpInitialized ? 'Enabled' : 'Emulated'}`);
        console.log(`- Service Integration: ${servicesInitialized ? 'Enabled' : 'Limited'}`);
        console.log(`- Capabilities: ${agent.capabilities.join(', ')}`);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('Shutting down simplified agent...');
            agent.disconnect();
            process.exit(0);
        });
    } catch (error) {
        console.error('Failed to start agent:', error);
        process.exit(1);
    }
})(); 