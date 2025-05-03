import { useEffect, useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { BrowserClientSDK } from "../../lib/browser-client-sdk";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "../ui/button";

interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  status: string;
}

interface AgentSelectorProps {
  client: BrowserClientSDK | null;
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAgents = async () => {
    if (!client || !isConnected) return;
    
    setIsLoading(true);
    try {
      const agentList = await client.getAgents();
      // Only include online agents with chat capability
      const availableAgents = agentList.filter(
        (agent: Agent) => 
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