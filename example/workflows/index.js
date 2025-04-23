const fs = require('fs').promises;
const path = require('path');

/**
 * Load all workflow definitions from the workflows directory
 * @returns {Promise<Array>} Array of workflow definitions
 */
async function loadWorkflows() {
  try {
    const workflowsDir = path.join(__dirname);
    const files = await fs.readdir(workflowsDir);
    
    const workflowFiles = files.filter(file => 
      file !== 'index.js' && 
      (file.endsWith('.js') || file.endsWith('.json'))
    );
    
    const workflows = [];
    
    for (const file of workflowFiles) {
      try {
        // For JS files, require them
        if (file.endsWith('.js')) {
          const workflow = require(path.join(workflowsDir, file));
          workflows.push(workflow);
        } 
        // For JSON files, read and parse them
        else if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(workflowsDir, file), 'utf8');
          const workflow = JSON.parse(content);
          workflows.push(workflow);
        }
      } catch (error) {
        console.error(`Error loading workflow from ${file}:`, error);
      }
    }
    
    return workflows;
  } catch (error) {
    console.error('Error loading workflows:', error);
    return [];
  }
}

// Sample predefined workflows if no files are found
const predefinedWorkflows = [
  {
    name: 'research-and-summarize',
    description: 'Perform research on a topic and summarize the findings',
    initialMessage: {
      query: 'Agent Swarm Protocol',
      maxResults: 5
    },
    steps: [
      {
        id: 'research',
        agent: 'research-agent',
        message: {
          type: 'task.research',
          content: {
            input: {
              query: '{{initialMessage.query}}',
              maxResults: '{{initialMessage.maxResults}}'
            }
          }
        }
      },
      {
        id: 'summarize',
        agent: 'summarization-agent',
        dependsOn: 'research',
        message: {
          type: 'task.summarize',
          content: {
            input: {
              content: '{{research.response.content.result.analysis}}',
              options: {
                maxLength: 'concise',
                style: 'informative',
                extractKeyPoints: true
              }
            }
          }
        }
      },
      {
        id: 'present',
        agent: 'conversation-agent',
        dependsOn: 'summarize',
        message: {
          type: 'task.conversation',
          content: {
            input: {
              message: `I've researched "${initialMessage.query}" and found the following:\n\nSummary: {{summarize.response.content.result.summary}}\n\nKey Points:\n{{summarize.response.content.result.keyPoints.join('\n- ')}}`
            }
          }
        }
      }
    ],
    output: '{{present.response.content.result}}'
  },
  {
    name: 'interactive-conversation',
    description: 'Handle an interactive conversation with a user',
    initialMessage: {
      message: 'Hello, how can I help you today?'
    },
    steps: [
      {
        id: 'converse',
        agent: 'conversation-agent',
        message: {
          type: 'task.conversation',
          content: {
            input: {
              message: '{{initialMessage.message}}'
            }
          }
        }
      }
    ],
    output: '{{converse.response.content.result}}'
  }
];

// Export functions
module.exports = {
  loadWorkflows: async () => {
    const fileWorkflows = await loadWorkflows();
    
    // If no file workflows found, return predefined ones
    if (fileWorkflows.length === 0) {
      return predefinedWorkflows;
    }
    
    return fileWorkflows;
  }
}; 