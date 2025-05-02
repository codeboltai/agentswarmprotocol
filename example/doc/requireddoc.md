## Orchestrator Client Communication

### Orchestrator -> Client
- 'orchestrator.welcome'
- 'agent.list'
- 'task.created'
- 'task.status'
- 'task.result'
- 'task.notification'
- 'error'
- 'mcp.server.list'

### Client -> Orchestrator
- 'task.create'
- 'task.status.request'
- 'agent.list.request'
- 'mcp.server.list.request'

## Orchestrator Agent Communication

### Agent -> Orchestrator
- 'agent.register'
- 'task.result'
- 'service.request'
- 'agent.response'
- 'agent.status.update'
- 'pong'
- 'mcp.servers.list.request'
- 'mcp.tools.list.request'
- 'mcp.tool.execute.request'
- 'agent.list.request'
- 'agent.task.request'

### Orchestrator -> Agent
- 'orchestrator.welcome'
- 'agent.registered'
- 'task.execute'
- 'service.response'
- 'error'
- 'agent.request'
- 'agent.request.accepted'
- 'ping'
- 'mcp.servers.list'
- 'mcp.tools.list'
- 'mcp.tool.execution.result'
- 'agent.list.response'
- 'agent.task.response'

## Orchestrator Service Communication

### Service -> Orchestrator
- 'service.register'
- 'service.status.update'
- 'service.task.result'
- 'service.task.notification'
- 'pong'

### Orchestrator -> Service
- 'orchestrator.welcome'
- 'service.registered'
- 'service.task.execute'
- 'error'
- 'ping'
