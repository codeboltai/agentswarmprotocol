import { useEffect, useState } from 'react';
// App.css import has been removed as it's merged into index.css
import { ChatContainer } from './components/chat/chat-container';
import { v4 as uuidv4 } from 'uuid';
// Import using dynamic import instead
import { Pencil1Icon, GitHubLogoIcon } from '@radix-ui/react-icons';
import { ThemeToggle } from './components/ui/theme-toggle';
import { AgentInfo } from '@agentswarmprotocol/types';
import { EventEmitter } from 'events';
import { SwarmClientSDK } from '@agentswarmprotocol/clientsdk';

// Establish connection to the orchestrator
const ORCHESTRATOR_URL = 'ws://localhost:3001';

// Define message and error types
interface AgentMessage {
  type: string;
  content: { text?: string; [key: string]: unknown };
  agentId?: string;
}

interface ClientError {
  message: string;
}

// Create a client interface for the UI
interface SimpleClient {
  getAgents: () => Promise<AgentInfo[]>;
  sendMessage: (message: Record<string, unknown>) => Promise<unknown>;
  connect: () => Promise<void>;
  disconnect: () => void;
  on(event: 'connected' | 'disconnected', listener: () => void): void;
  on(event: 'message', listener: (message: AgentMessage) => void): void;
  on(event: 'error', listener: (error: ClientError) => void): void;
}

// Initialize the real client
function createClient(): SimpleClient {
  const emitter = new EventEmitter();
  
  try {
    // Create new client instance
    const client = new SwarmClientSDK({
      orchestratorUrl: ORCHESTRATOR_URL
    });
    
    // Forward all events from real client with proper typing
    client.on('connected', () => emitter.emit('connected'));
    client.on('disconnected', () => emitter.emit('disconnected'));
    client.on('message', (msg: AgentMessage) => emitter.emit('message', msg));
    client.on('error', (err: ClientError) => emitter.emit('error', err));
    
    console.log('Successfully initialized SwarmClientSDK');
    
    const clientInterface: SimpleClient = {
      async getAgents(): Promise<AgentInfo[]> {
        return client.getAgents();
      },
      
      async sendMessage(message: Record<string, unknown>): Promise<unknown> {
        return client.sendRequest(message);
      },
      
      async connect(): Promise<void> {
        try {
          await client.connect();
        } catch (error) {
          console.error('Connection error:', error);
          throw error;
        }
      },
      
      disconnect(): void {
        try {
          client.disconnect();
        } catch (error) {
          console.error('Disconnect error:', error);
        }
      },
      
      on(event: 'connected' | 'disconnected' | 'message' | 'error', 
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         listener: (...args: any[]) => void): void {
        emitter.on(event, listener);
      }
    };
    
    return clientInterface;
  } catch (error) {
    console.error('Failed to initialize client:', error);
    throw error;
  }
}

// Message interface for the chat
interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "agent" | "system";
  timestamp: string;
  agentId?: string;
  agentName?: string;
}

function App() {
  const [client, setClient] = useState<SimpleClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      content: "Welcome to Agent Swarm Protocol! Select an agent and type a message to get started.",
      type: "system",
      timestamp: new Date().toISOString(),
    },
  ]);

  // Fetch agents and build ID to name mapping
  const fetchAgents = async () => {
    if (!client || !isConnected) return;
    
    try {
      const agentList = await client.getAgents();
      const nameMap: Record<string, string> = {};
      
      agentList.forEach((agent: AgentInfo) => {
        nameMap[agent.id] = agent.name;
      });
      
      setAgentNames(nameMap);
      return agentList;
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      return [];
    }
  };

  // Initialize the client
  useEffect(() => {
    let simpleClient: SimpleClient;
    
    try {
      // Create a client
      simpleClient = createClient();
      
      // Set up event listeners
      simpleClient.on('connected', () => {
        setIsConnected(true);
        console.log('Connected to orchestrator');
        
        // Add a system message indicating connection
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            content: "Connected to orchestrator. Please select an agent to chat with.",
            type: "system",
            timestamp: new Date().toISOString(),
          }
        ]);
        
        // Fetch agents when connected
        fetchAgents();
      });

      simpleClient.on('disconnected', () => {
        setIsConnected(false);
        console.log('Disconnected from orchestrator');
        
        // Add a system message indicating disconnection
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            content: "Disconnected from orchestrator. Attempting to reconnect...",
            type: "system",
            timestamp: new Date().toISOString(),
          }
        ]);
      });

      simpleClient.on('message', (message: AgentMessage) => {
        console.log('Message received:', message);
        
        // Handle incoming messages from agents
        if (message.type === 'agent.message') {
          setMessages(prev => [
            ...prev,
            {
              id: uuidv4(),
              content: message.content.text || JSON.stringify(message.content),
              type: "agent",
              timestamp: new Date().toISOString(),
              agentId: message.agentId,
              agentName: message.agentId ? agentNames[message.agentId] : undefined
            }
          ]);
          setIsLoading(false);
        }
        
        // Handle task updates
        if (message.type === 'task.update') {
          const taskUpdate = message.content;
          
          if (taskUpdate.status === 'completed') {
            setIsLoading(false);
          }
        }
      });

      simpleClient.on('error', (error: ClientError) => {
        console.error('Client error:', error);
        
        // Add a system message for errors with better error message handling
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            content: `Error: ${error.message || 'Connection failed. Is the orchestrator running?'}`,
            type: "system",
            timestamp: new Date().toISOString(),
          }
        ]);
      });

      setClient(simpleClient);
      
      // Connect to the orchestrator
      simpleClient.connect().catch((error: unknown) => {
        console.error('Connection error:', error);
        
        // Add a system message for connection errors
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            content: `Connection error: ${error instanceof Error ? error.message : 'Failed to connect to orchestrator'}. Make sure the orchestrator is running on ${ORCHESTRATOR_URL}.`,
            type: "system",
            timestamp: new Date().toISOString(),
          }
        ]);
      });

      // Clean up connection on unmount
      return () => {
        if (simpleClient) {
          simpleClient.disconnect();
        }
      };
    } catch (error) {
      console.error('Failed to initialize client:', error);
      
      // Add a system message for initialization errors
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          content: `Failed to initialize client: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure @agentswarmprotocol/clientsdk is installed and configured correctly.`,
          type: "system",
          timestamp: new Date().toISOString(),
        }
      ]);
    }
  }, []);

  // Handle agent selection
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    
    // Add a system message indicating the agent selection
    setMessages(prev => [
      ...prev,
      {
        id: uuidv4(),
        content: `Now chatting with: ${agentNames[agentId] || `Agent (${agentId.substring(0, 8)}...)`}`,
        type: "system",
        timestamp: new Date().toISOString(),
      }
    ]);
  };

  // Send a message to the orchestrator
  const handleSendMessage = (content: string, agentId?: string) => {
    if (!client || !isConnected) return;
    
    // Get the target agent
    const targetAgentId = agentId || selectedAgentId;
    
    if (!targetAgentId) {
      // Add system message if no agent is selected
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          content: "Please select an agent to chat with first.",
          type: "system",
          timestamp: new Date().toISOString(),
        }
      ]);
      return;
    }
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content,
      type: "user",
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Send message to orchestrator with the specific agent target
    client.sendMessage({
      type: 'client.message',
      content: {
        text: content,
        role: 'user',
        target: {
          type: 'agent',
          id: targetAgentId
        }
      }
    })
    .catch((error: unknown) => {
      console.error('Failed to send message:', error);
      setIsLoading(false);
      
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          content: `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: "system",
          timestamp: new Date().toISOString(),
        }
      ]);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="bg-card py-3 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Pencil1Icon className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Agent Swarm Protocol</h1>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <a href="https://github.com/AgentSwarmProtocol/example" 
              target="_blank" 
              rel="noreferrer" 
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
              <GitHubLogoIcon className="h-4 w-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)]">
          <ChatContainer
            onSendMessage={handleSendMessage}
            messages={messages}
            isConnected={isConnected}
            isLoading={isLoading}
            client={client}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleAgentChange}
            agentNames={agentNames}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
