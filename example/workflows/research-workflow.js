/**
 * Research Workflow
 * This workflow demonstrates how to perform research on a topic using the research-agent
 * and then summarize the results using the summarization-agent.
 */
module.exports = {
  name: 'research-workflow',
  description: 'Research a topic and provide a detailed summary',
  initialMessage: {
    query: 'Artificial Intelligence',
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
              maxLength: 'detailed',
              style: 'academic',
              extractKeyPoints: true
            }
          }
        }
      }
    }
  ],
  output: {
    topic: '{{initialMessage.query}}',
    searchResults: '{{research.response.content.result.searchResults}}',
    summary: '{{summarize.response.content.result.summary}}',
    keyPoints: '{{summarize.response.content.result.keyPoints}}'
  }
}; 