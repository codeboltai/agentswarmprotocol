---
sidebar_position: 1
---

# Introduction

The **Agent Swarm Protocol (ASP)** is a revolutionary approach to orchestrating multiple AI agents working together as a coordinated swarm. Unlike other protocols, ASP provides a robust framework for enabling powerful multi-agent collaboration through a centralized orchestrator.

## What is Agent Swarm Protocol?

Agent Swarm Protocol is designed to facilitate the seamless coordination of multiple specialized agents, allowing them to work together to solve complex problems. By leveraging a central orchestrator, ASP provides core services, tools, and utilities that enable agents to focus on their specialized tasks while the orchestrator handles communication, state management, and resource allocation.

## How ASP Differs from Other Protocols

### ASP vs. Machine Communication Protocol (MCP)

**MCP** primarily focuses on providing tools to LLMs, where the LLM calls the tools and the tools execute and send back the result. This creates a direct one-to-one relationship between the LLM and its tools.

**ASP**, on the other hand, enables many-to-many relationships between agents and services through its orchestrator, facilitating complex workflows involving multiple specialized agents working in concert.

### ASP vs. Agent-to-Agent (A2A)

**A2A** focuses on chaining opaque blackbox agents, where one agent can call another agent. The challenge with A2A is that each agent must be capable of handling numerous functionalities independently, such as LLM communication.

**ASP** solves this by centralizing common services in the orchestrator, allowing agents to be more specialized and efficient while still being able to collaborate through standardized communication channels.

## Key Components of ASP

1. **Orchestrator**: The central coordinator that provides:
   - Core services (LLM calling, logging, state management)
   - Tool integration (including MCP support)
   - Agent discovery and management

2. **Agents**: Specialized modules with clearly defined capabilities
   - Each agent has a manifest file defining its capabilities
   - Agents connect to the orchestrator via WebSocket for bidirectional communication
   - Agents can be composed hierarchically (parent-child relationships)

3. **Marketplace**: A registry of available agents and their capabilities

## Benefits of Agent Swarm Protocol

- **Specialization**: Agents can focus on specific tasks without needing to implement common functionalities
- **Scalability**: Easily add new agents to extend system capabilities
- **Bidirectional Communication**: Asynchonous communication between orchestrator and agents
- **Hierarchical Composition**: Support for parent-child agent relationships
- **Standardization**: Consistent interface between agents and the orchestrator

## Getting Started

To begin working with Agent Swarm Protocol, proceed to the [Installation](./installation) guide to set up your environment, followed by the [Quick Start](./quick-start) tutorial to create your first agent swarm.
