---
sidebar_position: 9
---

# Agent Collaboration Patterns

> **Note**: Agent Swarm Protocol has moved away from predefined workflow configurations in favor of dynamic, direct agent-to-agent communication. This document provides guidelines for implementing effective agent collaboration patterns.

## Introduction

While the Agent Swarm Protocol originally supported static workflows, the framework has evolved to embrace a more flexible, dynamic approach to agent collaboration. Instead of defining rigid workflows, agents can now directly communicate with each other and decide at runtime which other agents to collaborate with based on the task at hand.

## From Workflows to Dynamic Collaboration

### The Evolution

Previous versions of ASP relied on workflow definitions that required:
- Static agent relationships
- Predefined message flows
- Orchestrator-managed workflow execution

The new approach:
- Enables direct agent-to-agent communication
- Allows agents to dynamically discover and collaborate with other agents
- Reduces orchestrator involvement in managing workflows
- Increases agent autonomy and flexibility

## Agent-to-Agent Communication

Agents can request tasks from other agents directly:

```javascript
// Example of an agent requesting a task from another agent
const researchResult = await this.requestAgentTask(
  'Research Agent',  // Target agent name
  {
    taskType: 'research.query',
    query: 'quantum computing advancements',
    context: {
      originAgent: 'Conversation Agent',
      priority: 'high'
    }
  }
);
```

## Collaboration Patterns

### 1. Chain of Thought

Multiple agents contribute to solving a complex problem step by step, with each agent handling a specific part of the reasoning process:

```javascript
async handleComplexQuery(task) {
  // Step 1: Break down the problem using the Planning Agent
  const planResult = await this.requestAgentTask('Planning Agent', {
    taskType: 'planning.decompose',
    query: task.data.query
  });
  
  // Step 2: For each sub-problem, request specialized agent help
  const subResults = await Promise.all(planResult.subProblems.map(async (subProblem) => {
    const specialistAgentName = this.findBestAgentForTask(subProblem.type);
    return this.requestAgentTask(specialistAgentName, {
      taskType: 'problem.solve',
      problem: subProblem.description,
      context: { originalQuery: task.data.query }
    });
  }));
  
  // Step 3: Synthesize results using the Integration Agent
  const finalResult = await this.requestAgentTask('Integration Agent', {
    taskType: 'integration.synthesize',
    subResults: subResults,
    originalQuery: task.data.query
  });
  
  return finalResult;
}
```

### 2. Critic & Refinement

One agent generates an initial result, which another agent critiques and refines:

```javascript
async generateAndRefineContent(task) {
  // Step 1: Generate initial content
  const initialContent = await this.requestAgentTask('Content Generator', {
    taskType: 'content.generate',
    topic: task.data.topic,
    length: task.data.length
  });
  
  // Step 2: Have the critic agent review the content
  const critique = await this.requestAgentTask('Critic Agent', {
    taskType: 'content.critique',
    content: initialContent,
    criteria: ['accuracy', 'clarity', 'style']
  });
  
  // Step 3: Refine the content based on critique
  if (critique.needsRevision) {
    const refinedContent = await this.requestAgentTask('Content Generator', {
      taskType: 'content.refine',
      originalContent: initialContent,
      feedback: critique.feedback,
      revisionInstructions: critique.revisionInstructions
    });
    
    return refinedContent;
  }
  
  return initialContent;
}
```

### 3. Concurrent Expert Consultation

Multiple specialist agents work in parallel on the same problem, then their outputs are compared or combined:

```javascript
async multiExpertConsultation(task) {
  // Identify relevant experts for the task
  const expertAgents = this.identifyRelevantExperts(task.data.domain);
  
  // Request analyses from all experts concurrently
  const expertOpinions = await Promise.all(expertAgents.map(expert => 
    this.requestAgentTask(expert.name, {
      taskType: 'analysis.provide',
      subject: task.data.subject,
      context: task.data.context
    })
  ));
  
  // Combine or compare the expert opinions
  const consolidatedResult = await this.requestAgentTask('Consensus Agent', {
    taskType: 'opinions.consolidate',
    opinions: expertOpinions,
    method: task.data.consolidationMethod || 'majority'
  });
  
  return consolidatedResult;
}
```

### 4. Decision Tree Execution

Agents follow a decision tree pattern where each node represents a decision point:

```javascript
async executeDecisionTree(task) {
  let currentNode = task.data.startNode || 'root';
  const context = { ...task.data.context };
  
  while (true) {
    // Get the current node's agent and task type
    const nodeConfig = this.decisionTree[currentNode];
    if (!nodeConfig) {
      throw new Error(`Decision tree node "${currentNode}" not found`);
    }
    
    // Execute the current node
    const result = await this.requestAgentTask(nodeConfig.agent, {
      taskType: nodeConfig.taskType,
      ...nodeConfig.parameters,
      context
    });
    
    // Update context with the result
    Object.assign(context, result);
    
    // Determine the next node
    if (nodeConfig.isTerminal) {
      return result;
    }
    
    // Use the decision function to determine the next node
    currentNode = nodeConfig.nextNode(result);
  }
}
```

## Implementing Collaboration Patterns

To implement these patterns:

1. **Define Agent Capabilities**: Each agent should clearly define its capabilities and the tasks it can perform.

2. **Context Passing**: Make sure to pass relevant context information between agents to maintain continuity.

3. **Error Handling**: Implement robust error handling for agent-to-agent communication failures.

4. **Timeouts**: Set appropriate timeouts for inter-agent communication to prevent blocking.

5. **Fallbacks**: Define fallback strategies when certain agents are unavailable or fail to respond.

Example framework for defining agent collaboration capabilities:

```javascript
class CollaborativeAgent extends SwarmAgentSDK {
  constructor(config) {
    super(config);
    this.collaborationPatterns = {
      'research-and-summarize': this.researchAndSummarizePattern,
      'generate-and-critique': this.generateAndCritiquePattern,
      'analyze-and-decide': this.analyzeAndDecidePattern
    };
  }
  
  // Initialize with known collaborator agents
  setCollaborators(collaborators) {
    this.collaborators = collaborators;
  }
  
  // Find the appropriate agent based on capability
  findAgentWithCapability(capability) {
    return this.collaborators.find(a => 
      a.capabilities && a.capabilities.includes(capability)
    );
  }
  
  // Example collaboration pattern
  async researchAndSummarizePattern(query, context = {}) {
    const researchAgent = this.findAgentWithCapability('research');
    const summaryAgent = this.findAgentWithCapability('summarization');
    
    if (!researchAgent || !summaryAgent) {
      throw new Error('Required collaborator agents not available');
    }
    
    // Step 1: Research
    const researchResult = await this.requestAgentTask(researchAgent.name, {
      taskType: 'research.query',
      query,
      context
    });
    
    // Step 2: Summarize
    const summary = await this.requestAgentTask(summaryAgent.name, {
      taskType: 'content.summarize',
      content: researchResult.content,
      length: context.summaryLength || 'medium',
      format: context.summaryFormat || 'text'
    });
    
    return {
      original: researchResult,
      summary: summary
    };
  }
}
```

## Best Practices

1. **Dynamic Discovery**: Agents should be able to discover available collaborator agents at runtime.

2. **Resource Awareness**: Consider resource constraints when requesting tasks from other agents.

3. **Task Prioritization**: Include priority levels in task requests to help receiving agents prioritize.

4. **Circular References**: Avoid circular dependencies between agents that could lead to infinite loops.

5. **Monitoring & Observability**: Implement tracing for agent-to-agent communications to aid debugging.

6. **Idempotency**: Design agent communications to be idempotent when possible.

By implementing these collaborative patterns, you can create sophisticated agent systems that dynamically work together to solve complex problems without requiring rigid workflow definitions. 