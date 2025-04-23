---
sidebar_position: 7
---

# Orchestrator Configuration

This document provides a detailed guide on configuring the Agent Swarm Protocol orchestrator to meet your specific requirements.

## Configuration Options

The orchestrator can be configured through a combination of environment variables and a configuration file. Below are the key configuration options:

### Basic Configuration

- **Port**: The port on which the orchestrator will listen for incoming requests.
- **Host**: The host address to bind the orchestrator service.
- **Log Level**: Control the verbosity of logging output.

### Agent Management

- **Auto-discovery**: Enable or disable automatic discovery of agent services.
- **Registration timeout**: Set how long to wait for agent registration before timing out.
- **Health check interval**: Frequency of agent health checks.

### Authentication & Security

- **API Keys**: Configure API keys for secure access to the orchestrator.
- **Rate limiting**: Control request rates to prevent abuse.
- **CORS settings**: Configure Cross-Origin Resource Sharing for browser-based clients.

## Example Configuration

```yaml
orchestrator:
  port: 3000
  host: "0.0.0.0"
  logLevel: "info"
  
agents:
  autoDiscovery: true
  registrationTimeout: 30s
  healthCheckInterval: 60s
  
security:
  apiKeys: true
  rateLimiting:
    enabled: true
    maxRequests: 100
    window: 60s
  cors:
    enabled: true
    allowedOrigins: ["https://example.com"]
```

## Environment Variables

You can override configuration file settings with environment variables:

```
ASP_ORCHESTRATOR_PORT=3000
ASP_ORCHESTRATOR_HOST=0.0.0.0
ASP_LOG_LEVEL=info
ASP_SECURITY_API_KEYS_ENABLED=true
``` 