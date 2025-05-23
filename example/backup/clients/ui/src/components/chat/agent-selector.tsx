import { useEffect, useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Agent as AgentInfo } from "@agentswarmprotocol/types/common";

// Define message types
interface AgentMessage {
  type: string;
  content: { text?: string; [key: string]: unknown };
  agentId?: string;
}

interface ClientError {
  message: string;
}

// Simple client interface that matches App.tsx
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

interface AgentSelectorProps {
  client: SimpleClient | null;
  isConnected: boolean;
  selectedAgentId: string | null;
  onAgentChange: (agentId: string) => void;
  className?: string;
}

export function AgentSelector({
  client,
  isConnected,
  selectedAgentId,
  onAgentChange,
  className = "",
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAgents = async () => {
    if (!client || !isConnected) return;
    
    setIsLoading(true);
    try {
      const agentList = await client.getAgentsList();
      // Only include online agents with chat capability
      const availableAgents = agentList.filter(
        (agent: AgentInfo) => 
          agent.status === 'online' && 
          agent.capabilities?.includes('chat')
      );
      setAgents(availableAgents);
      
      // Auto-select first agent if none selected
      if (availableAgents.length > 0 && !selectedAgentId) {
        onAgentChange(availableAgents[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchAgents();
    }
  }, [isConnected, client]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select
        disabled={!isConnected || isLoading || agents.length === 0}
        value={selectedAgentId || ""}
        onValueChange={onAgentChange}
      >
        <SelectTrigger className="min-w-[200px]">
          <SelectValue 
            placeholder={
              isLoading 
                ? "Loading agents..." 
                : agents.length === 0 
                ? "No agents available" 
                : "Select an agent"
            } 
          />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={!isConnected}
        onClick={fetchAgents}
      >
        <RefreshCwIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
} 