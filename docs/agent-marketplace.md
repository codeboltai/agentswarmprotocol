---
sidebar_position: 7
---

# Agent Marketplace

The Agent Swarm Protocol (ASP) includes a marketplace system that facilitates the discovery, sharing, and deployment of agents. This guide explains how the marketplace works and how to publish and consume agents from it.

## Marketplace Overview

The ASP Marketplace is a registry of agents that provides:

1. **Discovery**: Find existing agents with specific capabilities
2. **Distribution**: Share your agents with the community
3. **Versioning**: Support for multiple versions of the same agent
4. **Metadata**: Detailed information about each agent
5. **Ratings & Reviews**: Community feedback on agent quality

## Finding Agents

You can search for agents using various criteria:

```javascript
// Using the orchestrator's service
const agents = await orchestrator.requestService('marketplace', {
  action: 'search',
  query: 'text-processing',
  capabilities: ['text.summarize', 'text.analyze'],
  tags: ['nlp', 'analysis'],
  limit: 10
});

// Using CLI
$ asp marketplace search --query="text-processing" --capabilities="text.summarize,text.analyze"
```

## Agent Metadata

Each agent in the marketplace includes metadata:

```json
{
  "name": "text-processor",
  "version": "1.2.0",
  "description": "An agent that processes and analyzes text",
  "author": "Jane Doe",
  "repository": "https://github.com/janedoe/text-processor",
  "license": "MIT",
  "homepage": "https://text-processor.example.com",
  "capabilities": [
    "text.summarize",
    "text.analyze",
    "text.translate"
  ],
  "requiredServices": [
    "llm",
    "storage"
  ],
  "tags": ["nlp", "text", "analysis"],
  "rating": 4.8,
  "downloads": 1250,
  "created": "2023-01-15T12:00:00Z",
  "updated": "2023-06-20T15:30:00Z"
}
```

## Installing Agents

You can easily install agents from the marketplace:

```javascript
// Using the orchestrator's service
await orchestrator.requestService('marketplace', {
  action: 'install',
  agentName: 'text-processor',
  version: '1.2.0'  // Optional, defaults to latest
});

// Using CLI
$ asp marketplace install text-processor --version=1.2.0
```

## Creating a Publishable Agent

To make your agent ready for the marketplace, follow these steps:

### 1. Create a Proper Manifest

Ensure your agent has a complete manifest:

```json
{
  "name": "my-custom-agent",
  "version": "1.0.0",
  "description": "An agent that performs custom operations",
  "entryPoint": "index.js",
  "capabilities": [
    "custom.capability1",
    "custom.capability2"
  ],
  "requiredServices": [
    "llm",
    "storage"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": "https://github.com/yourusername/my-custom-agent",
  "homepage": "https://my-custom-agent.example.com",
  "keywords": ["custom", "example", "agent"],
  "dependencies": {
    "some-library": "^1.0.0"
  }
}
```

### 2. Document Your Agent

Create a README.md file in your agent's directory:

```markdown
# My Custom Agent

An agent that performs custom operations using the Agent Swarm Protocol.

## Capabilities

- `custom.capability1`: Performs custom operation 1
- `custom.capability2`: Performs custom operation 2

## Required Services

- `llm`: Used for text generation
- `storage`: Used for storing state

## Usage

Example of how to interact with this agent:

```javascript
await agent.send({
  recipient: 'my-custom-agent',
  type: 'custom.capability1.request',
  content: { param1: 'value1', param2: 'value2' }
});
```

## Configuration

The agent accepts the following configuration options:

- `apiKey`: API key for external service (required)
- `maxRetries`: Maximum number of retry attempts (default: 3)
```

### 3. Test Your Agent

Before publishing, thoroughly test your agent:

```javascript
// test-agent.js
const { MockOrchestrator } = require('@agent-swarm/test-utils');
const MyAgent = require('./my-agent');

async function testAgent() {
  // Create a mock orchestrator
  const mockOrchestrator = new MockOrchestrator();
  
  // Create and connect the agent
  const agent = new MyAgent({
    manifestPath: './manifest.json'
  });
  
  // Connect to mock orchestrator
  await agent.connect(mockOrchestrator.getConnectionUrl());
  
  // Run tests...
  
  // Disconnect
  await agent.disconnect();
}

testAgent().catch(console.error);
```

## Publishing to the Marketplace

Once your agent is ready, you can publish it to the marketplace:

```javascript
// Using the orchestrator's service
await orchestrator.requestService('marketplace', {
  action: 'publish',
  agentDir: './path/to/my-custom-agent',
  public: true  // Make publicly available
});

// Using CLI
$ asp marketplace publish ./path/to/my-custom-agent --public
```

### Publishing Requirements

To publish an agent, you need to meet these requirements:

1. Complete manifest file
2. README documentation
3. Proper licensing information
4. Passing tests
5. Agent authentication credentials

### Version Management

The marketplace supports semantic versioning for agents:

```javascript
// Publish a new version
await orchestrator.requestService('marketplace', {
  action: 'publish',
  agentDir: './path/to/my-custom-agent',
  version: '1.1.0',  // New version
  releaseNotes: 'Added new feature X and fixed bug Y'
});

// Using CLI
$ asp marketplace publish ./path/to/my-custom-agent --version=1.1.0 --notes="Added new feature X and fixed bug Y"
```

## Marketplace Categories

Agents in the marketplace are organized into categories:

- **Text Processing**: Agents for analyzing, summarizing, or transforming text
- **Data Processing**: Agents for manipulating structured data
- **Web Interaction**: Agents for interacting with web services
- **Utilities**: Helper agents for common tasks
- **Domain-Specific**: Agents for particular industries or domains
- **Integration**: Agents that connect to external services
- **AI & ML**: Agents that leverage machine learning models
- **Communication**: Agents that facilitate communication between systems

## Private Marketplace

For enterprise or team use, you can set up a private marketplace:

```javascript
// Create a private marketplace
const privateMarketplace = new AgentMarketplace({
  name: 'Company Internal Marketplace',
  private: true,
  adminUsers: ['admin1', 'admin2'],
  allowedDomains: ['company.com']
});

// Connect orchestrator to private marketplace
const orchestrator = new Orchestrator({
  // ... other options
  marketplace: {
    url: 'https://marketplace.company.internal',
    authToken: process.env.MARKETPLACE_AUTH_TOKEN
  }
});
```

## Agent Versioning

The marketplace handles agent versioning using semantic versioning (SemVer):

```javascript
// Get a specific version
await orchestrator.requestService('marketplace', {
  action: 'install',
  agentName: 'text-processor',
  version: '1.2.0'
});

// Get the latest version
await orchestrator.requestService('marketplace', {
  action: 'install',
  agentName: 'text-processor',
  version: 'latest'
});

// Get the latest minor version in 1.x series
await orchestrator.requestService('marketplace', {
  action: 'install',
  agentName: 'text-processor',
  version: '1.x'
});
```

## Agent Updates

You can check for and apply updates to installed agents:

```javascript
// Check for updates
const updates = await orchestrator.requestService('marketplace', {
  action: 'checkUpdates'
});

// Update a specific agent
await orchestrator.requestService('marketplace', {
  action: 'update',
  agentName: 'text-processor'
});

// Update all agents
await orchestrator.requestService('marketplace', {
  action: 'updateAll'
});

// Using CLI
$ asp marketplace update-all
```

## Agent Dependencies

Agents can depend on other agents, which will be automatically installed:

```json
{
  "name": "advanced-analyzer",
  "version": "1.0.0",
  "dependencies": {
    "text-processor": "^1.2.0",
    "data-visualizer": "^2.0.0"
  }
}
```

When installing this agent, the marketplace will automatically install the dependent agents if they're not already present.

## Marketplace API

The marketplace provides a REST API for integration with other systems:

```javascript
// Example: Marketplace API client
const MarketplaceClient = require('@agent-swarm/marketplace-client');

const client = new MarketplaceClient({
  url: 'https://marketplace.agentswarm.ai',
  authToken: process.env.MARKETPLACE_AUTH_TOKEN
});

// Search for agents
const searchResults = await client.search({
  query: 'text processing',
  limit: 10
});

// Install an agent
await client.install('text-processor', '1.2.0');

// Publish an agent
await client.publish('./path/to/my-agent', {
  public: true,
  releaseNotes: 'Initial release'
});
```

## Agent Verification

The marketplace includes a verification system to ensure agent quality and security:

```javascript
// Verify an agent before publishing
const verificationResult = await orchestrator.requestService('marketplace', {
  action: 'verify',
  agentDir: './path/to/my-agent'
});

if (verificationResult.issues.length > 0) {
  console.error('Verification issues:', verificationResult.issues);
} else {
  console.log('Agent verification passed!');
  // Proceed with publishing
}
```

Verification checks include:
- Manifest completeness and correctness
- Documentation quality
- Security vulnerabilities in dependencies
- Code quality metrics
- Proper error handling
- Compliance with marketplace guidelines

## Community Contributions

The marketplace encourages community contributions:

1. **Ratings & Reviews**: Users can rate and review agents
2. **Feature Requests**: Suggest improvements for existing agents
3. **Bug Reports**: Report issues with agents
4. **Forks & Improvements**: Create and share improved versions of agents

## Best Practices

### When Publishing Agents

- **Clear Documentation**: Document all capabilities and message formats
- **Comprehensive Testing**: Include tests for all functionality
- **Security First**: Never include sensitive credentials in your agent code
- **Minimal Dependencies**: Keep external dependencies to a minimum
- **Precise Versioning**: Follow semantic versioning principles
- **Responsive Maintenance**: Address bug reports and security issues promptly

### When Consuming Agents

- **Verify Reputation**: Check ratings and reviews before installing
- **Check Activity**: Prefer actively maintained agents
- **Review Security**: Assess security implications before installing
- **Test Integration**: Test the agent in a staging environment first
- **Version Pinning**: Pin to specific versions for production use

## Next Steps

Now that you understand the agent marketplace, you can:

1. Explore [advanced workflows](./advanced-workflows)
2. Learn about [orchestrator configuration](./orchestrator-configuration)
3. Dive into [security considerations](./security-considerations) 