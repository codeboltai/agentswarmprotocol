---
id: installation
title: SDK Installation
sidebar_position: 2
---

# SDK Installation Guide

This page guides you through installing and configuring the Agent Swarm Protocol SDK for your development environment.

## System Requirements

- Node.js 16.x or later
- npm 7.x or later
- Python 3.8+ (for certain features)

## Installation Steps

### Using npm

```bash
npm install @agent-swarm/sdk
```

### Using yarn

```bash
yarn add @agent-swarm/sdk
```

## Configuration

After installation, you'll need to initialize the SDK with your configuration:

```typescript
import { AgentSwarmSDK } from '@agent-swarm/sdk';

const sdk = new AgentSwarmSDK({
  apiKey: 'your-api-key',
  orchestratorUrl: 'https://your-orchestrator-instance.example.com',
  // Additional configuration options
});
```

## Verifying Installation

To verify that the SDK is correctly installed and configured, you can run a simple test:

```typescript
// Test connection to orchestrator
async function testConnection() {
  try {
    const status = await sdk.getStatus();
    console.log('Connection successful:', status);
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();
```

## Next Steps

Now that you have installed the SDK, check out the [SDK Overview](./overview) to learn about the available features and how to use them in your application. 