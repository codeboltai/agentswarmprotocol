import { useEffect, useState } from 'react';
// App.css import has been removed as it's merged into index.css
import { ChatContainer } from './components/chat/chat-container';
import { v4 as uuidv4 } from 'uuid';
import { BrowserClientSDK } from './lib/browser-client-sdk';
import { Pencil1Icon, GitHubLogoIcon } from '@radix-ui/react-icons';
import { ThemeToggle } from './components/ui/theme-toggle';

// Establish connection to the orchestrator
const ORCHESTRATOR_URL = 'ws://localhost:3001';

// Message interface for the chat
interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "agent" | "system";
  timestamp: string;
  agentId?: string;
}

// Define message and error types
interface AgentMessage {
  type: string;
  content: { text?: string; [key: string]: unknown };
  agentId?: string;
}

interface ClientError {
  message: string;
}

function App() {
  const [client, setClient] = useState<BrowserClientSDK | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      content: "Welcome to Agent Swarm Protocol! Type a message to get started.",
      type: "system",
      timestamp: new Date().toISOString(),
    },
  ]);

  // Initialize the client
  useEffect(() => {
    // Create a new BrowserClientSDK instance
    try {
      const sdk = new BrowserClientSDK({
        orchestratorUrl: ORCHESTRATOR_URL,
        autoConnect: false,
        clientId: `ui-client-${uuidv4()}`,
      });

      // Set up event listeners
      sdk.on('connected', () => {
        setIsConnected(true);
        console.log('Connected to orchestrator');
        
        // Add a system message indicating connection
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            content: "Connected to orchestrator.",
            type: "system",
            timestamp: new Date().toISOString(),
          }
        ]);
      });

      sdk.on('disconnected', () => {
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

      sdk.on('message', (message: AgentMessage) => {
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

      sdk.on('error', (error: ClientError) => {
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

      setClient(sdk);
      
      // Connect to the orchestrator
      sdk.connect().catch((error: Error) => {
        console.error('Connection error:', error);
        
        // Add a system message for connection errors
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            content: `Connection error: ${error.message || 'Failed to connect to orchestrator'}. Make sure the orchestrator is running on ${ORCHESTRATOR_URL}.`,
            type: "system",
            timestamp: new Date().toISOString(),
          }
        ]);
      });
    } catch (error: unknown) {
      console.error('Failed to initialize client:', error);
    }

    // Clean up connection on unmount
    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, []);

  // Send a message to the orchestrator
  const handleSendMessage = (content: string) => {
    if (!client || !isConnected) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content,
      type: "user",
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Send message to orchestrator
    client.sendMessage({
      type: 'client.message',
      content: {
        text: content,
        role: 'user'
      }
    })
    .catch((error: ClientError) => {
      console.error('Failed to send message:', error);
      setIsLoading(false);
      
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          content: `Failed to send message: ${error.message}`,
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
          />
        </div>
      </main>
    </div>
  );
}

export default App;
