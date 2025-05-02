## Orchestrator Client Communication

### Orchestrator -> Client
- 'orchestrator.welcome'
- 'agent.list'
- 'mcp.server.list'
- 'mcp.server.registered'
- 'task.result'
- 'task.status'
- 'task.created'
- 'error'
- 'mcp.operation.result'

### Client -> Orchestrator
- 'task.create'
- 'task.status.request'
- 'agent.list.request'
- 'mcp.server.register'
- 'mcp.server.list.request'
- 'mcp.operation.request'


## Orchestrator Agent Communication

### Orchestrator -> Agent
- 'orchestrator.welcome'
- 'agent.list'
- 'task.execute'
- 'agent.registered'
- 'service.response'
- 'error'
- 'agent.request'
- 'agent.request.accepted'
- 'ping'

### Agent -> Orchestrator
- 'agent.register'
- 'task.result'
- 'service.request'
- 'agent.response'
- 'agent.status.update'
- 'pong'

