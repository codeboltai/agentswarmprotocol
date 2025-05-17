import React, { useEffect, useRef, useState } from "react";
import { Message } from "./message";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { 
  PaperPlaneIcon, 
  ReloadIcon,
  ChatBubbleIcon,
  InfoCircledIcon
} from "@radix-ui/react-icons";
import { AgentSelector } from "./agent-selector";
import { Agent as AgentInfo } from "@agentswarmprotocol/types/common";

// Define message and error types for the SimpleClient interface
interface AgentMessage {
  type: string;
  content: { text?: string; [key: string]: unknown };
  agentId?: string;
}

interface ClientError {
  message: string;
}

// Use the SimpleClient interface consistent with App.tsx
interface SimpleClient {
  getAgentsList: () => Promise<AgentInfo[]>;
  sendRequestWaitForResponse: (message: Record<string, unknown>) => Promise<unknown>;
  connect: () => Promise<void>;
  disconnect: () => void;
  on(event: 'connected' | 'disconnected', listener: () => void): void;
  on(event: 'message', listener: (message: AgentMessage) => void): void;
  on(event: 'error', listener: (error: ClientError) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "agent" | "system";
  timestamp: string;
  agentId?: string;
  agentName?: string;
}

interface ChatContainerProps {
  onSendMessage: (message: string, agentId?: string) => void;
  messages: ChatMessage[];
  isConnected: boolean;
  isLoading?: boolean;
  client: SimpleClient | null;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  agentNames: Record<string, string>;
}

export function ChatContainer({
  onSendMessage,
  messages,
  isConnected,
  isLoading = false,
  client,
  selectedAgentId,
  onSelectAgent,
  agentNames = {}
}: ChatContainerProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && isConnected) {
      onSendMessage(input, selectedAgentId || undefined);
      setInput("");
    }
  };

  const connectionStatus = isConnected 
    ? "Connected to orchestrator" 
    : "Disconnected from orchestrator";

  const getSystemMessages = messages.filter(m => m.type === 'system').length;
  const getAgentMessages = messages.filter(m => m.type === 'agent').length;
  const getUserMessages = messages.filter(m => m.type === 'user').length;

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground rounded-lg shadow-xl">
      {/* Chat header with improved design */}
      <div className="p-4 bg-muted/30 rounded-t-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ChatBubbleIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Agent Swarm Protocol</h2>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => setShowInfo(!showInfo)}
            >
              <InfoCircledIcon className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {connectionStatus}
              </span>
            </div>
          </div>
        </div>
        
        {/* Agent selector and info panel */}
        <div className="mt-3 flex flex-col gap-3">
          <AgentSelector 
            client={client}
            isConnected={isConnected}
            selectedAgentId={selectedAgentId}
            onAgentChange={onSelectAgent}
          />
          
          {showInfo && (
            <div className="text-sm p-3 bg-muted/50 rounded shadow-sm">
              <div className="font-medium mb-1">Chat Statistics</div>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <div>User messages: {getUserMessages}</div>
                <div>Agent messages: {getAgentMessages}</div>
                <div>System messages: {getSystemMessages}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages area with improved styling */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <ChatBubbleIcon className="h-12 w-12 mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">No Messages Yet</h3>
            <p className="text-sm max-w-md">
              Start a conversation with the Agent Swarm by typing a message below.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <Message
              key={message.id}
              content={message.content}
              type={message.type}
              timestamp={message.timestamp}
              agentId={message.agentId}
              agentName={message.agentName || (message.agentId ? agentNames[message.agentId] : undefined)}
            />
          ))
        )}
        
        {isLoading && (
          <Message 
            content="" 
            type="agent" 
            isLoading={true} 
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area with enhanced styling */}
      <form onSubmit={handleSubmit} className="p-4 bg-card rounded-b-lg shadow-inner">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedAgentId ? `Message ${agentNames[selectedAgentId] || 'the selected agent'}...` : "Select an agent first..."}
              disabled={!isConnected || isLoading || !selectedAgentId}
              className="pr-12 min-h-[50px] bg-background focus-visible:ring-primary/50 shadow-sm border-0"
            />
            {isLoading && (
              <ReloadIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <Button 
            type="submit" 
            disabled={!isConnected || !input.trim() || isLoading || !selectedAgentId}
            className="min-h-[50px] px-5 shadow-sm"
          >
            <PaperPlaneIcon className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
        <div className="mt-2 text-xs text-center text-muted-foreground">
          {!isConnected 
            ? "Trying to reconnect to the orchestrator... (Make sure it's running on port 3001)"
            : !selectedAgentId
            ? "Please select an agent to start chatting"
            : `Sending messages to: ${agentNames[selectedAgentId] || 'Selected agent'}`}
        </div>
      </form>
    </div>
  );
} 