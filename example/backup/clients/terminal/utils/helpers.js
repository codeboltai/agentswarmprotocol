/**
 * Helper utilities for the terminal client
 */
const readline = require('readline');

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Helper for asking questions
 * @param {string} question - The question prompt to display
 * @returns {Promise<string>} - Promise resolving with the user's answer
 */
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

/**
 * Display the command prompt
 */
function displayPrompt() {
  process.stdout.write('\n> ');
}

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
 * Show help information
 */
function showHelp() {
  console.log('\nAgent Swarm Protocol Terminal Client');
  console.log('=======================================================');
  console.log('Available commands:');
  console.log('  agents     - List available agents');
  console.log('  task       - Send a task to an agent');
  console.log('  chat       - Start a chat session with an agent');
  console.log('  status     - Check task status');
  console.log('  mcp        - List available MCP servers');
  console.log('  help       - Show this help message');
  console.log('  exit       - Exit the client');
  console.log('=======================================================');
}

module.exports = {
  rl,
  ask,
  displayPrompt,
  formatDuration,
  showHelp
}; 