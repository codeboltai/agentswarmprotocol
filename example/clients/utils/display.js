/**
 * Display utilities for the terminal client
 * Handles formatting and displaying data in the terminal
 */

/**
 * Display the agent list
 * @param {Array} agents - List of agents to display
 */
function displayAgentList(agents) {
  console.log('\nAvailable Agents:');
  console.log('--------------------------------------------------------------');
  console.log('ID\t\t\t\tName\t\tStatus\tCapabilities');
  console.log('--------------------------------------------------------------');
  
  if (agents.length === 0) {
    console.log('No agents registered yet.');
  } else {
    agents.forEach(agent => {
      console.log(
        `${agent.id.substring(0, 8)}...\t${agent.name}\t\t${agent.status}\t${agent.capabilities.join(', ')}`
      );
    });
  }
  
  console.log('--------------------------------------------------------------');
}

/**
 * Display MCP servers list
 * @param {Array} mcpServers - List of MCP servers to display
 */
function displayMCPServersList(mcpServers) {
  console.log('\nAvailable MCP Servers:');
  console.log('--------------------------------------------------------------');
  console.log('ID\t\t\t\tName\t\tStatus\tType');
  console.log('--------------------------------------------------------------');
  
  if (mcpServers.length === 0) {
    console.log('No MCP servers registered yet.');
  } else {
    mcpServers.forEach(server => {
      const id = server.id.substring(0, 8) + '...';
      const name = server.name.length > 12 ? server.name.substring(0, 12) + '...' : server.name;
      const status = server.status || 'registered';
      const type = server.type || 'unknown';
      
      console.log(`${id}\t${name}\t\t${status}\t${type}`);
    });
  }
  
  console.log('--------------------------------------------------------------');
}

/**
 * Display task status
 * @param {Object} taskInfo - Task status information
 */
function displayTaskStatus(taskInfo) {
  console.log('\nTask Status:');
  console.log('--------------------------------------------------------------');
  console.log(`Task ID: ${taskInfo.taskId}`);
  console.log(`Status: ${taskInfo.status}`);
  console.log(`Created: ${taskInfo.createdAt}`);
  
  if (taskInfo.completedAt) {
    console.log(`Completed: ${taskInfo.completedAt}`);
  }
  
  if (taskInfo.result) {
    console.log('\nResult:');
    console.log(JSON.stringify(taskInfo.result, null, 2));
  }
  
  console.log('--------------------------------------------------------------');
}

/**
 * Display message in the chat UI
 * @param {string} agentName - Name of the agent
 * @param {string} message - Message to display
 */
function displayChatMessage(agentName, message) {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🤖 ${agentName}:`);
  console.log(message);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

module.exports = {
  displayAgentList,
  displayMCPServersList,
  displayTaskStatus,
  displayChatMessage
}; 