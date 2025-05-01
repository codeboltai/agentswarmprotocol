/**
 * Client state model for the terminal client
 * Manages the global application state
 */

// Initial client state
const state = {
  running: false,
  agents: [],
  tasks: {},
  mcpServers: [],
  client: null,
  chatState: {
    inChatSession: false,
    currentAgent: null,
    conversationId: null,
    messageHistory: [],
    initTaskId: null,
    currentTaskId: null,
    directResponseListener: null
  }
};

module.exports = state; 