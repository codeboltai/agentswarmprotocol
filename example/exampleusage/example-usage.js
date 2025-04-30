/**
 * Example usage of the ASP Orchestrator
 * This script demonstrates how to use the Orchestrator to manage agents, services, and tasks
 */

const { Orchestrator } = require('./orchestrator');

// Create a new orchestrator instance
const orchestrator = new Orchestrator();

// Example: Registering agents
console.log('=== Registering Agents ===');
const llmAgent = orchestrator.registerAgent({
  id: 'agent-llm-1',
  name: 'Language Model Assistant',
  type: 'llm',
  capabilities: ['text-generation', 'summarization', 'translation']
});
console.log('Registered LLM Agent:', llmAgent);

const searchAgent = orchestrator.registerAgent({
  id: 'agent-search-1',
  name: 'Web Search Agent',
  type: 'tool',
  capabilities: ['web-search', 'knowledge-retrieval']
});
console.log('Registered Search Agent:', searchAgent);

const imageAgent = orchestrator.registerAgent({
  id: 'agent-image-1',
  name: 'Image Generation Agent',
  type: 'tool',
  capabilities: ['image-generation']
});
console.log('Registered Image Agent:', imageAgent);

// Example: Registering services
console.log('\n=== Registering Services ===');
const textGenService = orchestrator.registerService({
  name: 'text-generation',
  providerId: 'agent-llm-1',
  category: 'content-creation',
  schema: {
    input: {
      prompt: 'string',
      max_tokens: 'number'
    },
    output: {
      text: 'string'
    }
  }
});
console.log('Registered Text Generation Service:', textGenService);

const searchService = orchestrator.registerService({
  name: 'web-search',
  providerId: 'agent-search-1',
  category: 'information-retrieval',
  schema: {
    input: {
      query: 'string',
      max_results: 'number'
    },
    output: {
      results: 'array'
    }
  }
});
console.log('Registered Search Service:', searchService);

const imageService = orchestrator.registerService({
  name: 'image-generation',
  providerId: 'agent-image-1',
  category: 'content-creation',
  schema: {
    input: {
      prompt: 'string',
      style: 'string',
      dimensions: 'string'
    },
    output: {
      image_url: 'string'
    }
  }
});
console.log('Registered Image Service:', imageService);

// Example: Creating a task
console.log('\n=== Creating Tasks ===');
const researchTask = orchestrator.createTask({
  type: 'research',
  name: 'Research on Quantum Computing',
  description: 'Find latest research papers on quantum computing and summarize the findings',
  input: {
    topic: 'quantum computing',
    max_papers: 5
  },
  requesterId: 'agent-llm-1'
});
console.log('Created Research Task:', researchTask);

// Example: Finding agents for a task
console.log('\n=== Finding Agents for Task ===');
const suitableAgents = orchestrator.findAgentsForTask(
  researchTask, 
  ['web-search', 'summarization']
);
console.log('Suitable Agents for Research Task:', suitableAgents);

// Example: Assigning a task to an agent
console.log('\n=== Assigning Task ===');
if (suitableAgents.length > 0) {
  const assignedTask = orchestrator.assignTask(researchTask.id, searchAgent.id);
  console.log('Assigned Research Task to Search Agent:', assignedTask);
  
  // Update task status
  console.log('\n=== Updating Task Status ===');
  const inProgressTask = orchestrator.updateTaskStatus(researchTask.id, 'in_progress', {
    note: 'Started searching for quantum computing research papers'
  });
  console.log('Updated Task Status to In Progress:', inProgressTask);
  
  // Simulate task completion
  const completedTask = orchestrator.updateTaskStatus(researchTask.id, 'completed', {
    note: 'Completed the research task',
    result: {
      papers: [
        { title: 'Recent Advances in Quantum Computing', url: 'https://example.com/paper1' },
        { title: 'Quantum Supremacy: A Review', url: 'https://example.com/paper2' },
        { title: 'Quantum Algorithms for Optimization Problems', url: 'https://example.com/paper3' }
      ],
      summary: 'The field of quantum computing is advancing rapidly with new breakthroughs in quantum supremacy and algorithm optimization...'
    }
  });
  console.log('Updated Task Status to Completed:', completedTask);
}

// Example: Get recommended services for a task
console.log('\n=== Getting Recommended Services ===');
const contentTask = {
  type: 'content-creation',
  name: 'Generate Marketing Content',
  input: {
    topic: 'AI technology benefits'
  }
};
const recommendedServices = orchestrator.getRecommendedServices(contentTask, 'content-creation');
console.log('Recommended Services for Content Task:', recommendedServices);

// Example: Get system statistics
console.log('\n=== System Statistics ===');
const stats = orchestrator.getStatistics();
console.log('System Statistics:', stats);

// Simulate agent going offline
console.log('\n=== Agent Status Update ===');
const offlineAgent = orchestrator.updateAgentStatus('agent-image-1', 'offline');
console.log('Updated Agent Status to Offline:', offlineAgent);

// Get all agents to verify status change
console.log('\n=== All Agents ===');
const allAgents = orchestrator.getAllAgents();
console.log('All Agents:', allAgents); 