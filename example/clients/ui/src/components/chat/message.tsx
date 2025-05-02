import React from "react";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { PersonIcon, RocketIcon, InfoCircledIcon } from "@radix-ui/react-icons";

type MessageType = "user" | "agent" | "system";

export interface MessageProps {
  content: string;
  type: MessageType;
  timestamp?: string;
  agentId?: string;
  isLoading?: boolean;
}

export function Message({
  content,
  type,
  timestamp,
  agentId,
  isLoading,
}: MessageProps) {
  // Define styles based on message type
  const isUser = type === "user";
  const isAgent = type === "agent";
  const isSystem = type === "system";

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get initial for avatar
  const getInitial = (messageType: MessageType, agentId?: string) => {
    if (messageType === "user") return "U";
    if (messageType === "agent") return agentId?.charAt(0).toUpperCase() || "A";
    return "S";
  };

  // Get avatar icon based on message type
  const getIcon = (messageType: MessageType) => {
    if (messageType === "user") return <PersonIcon className="h-5 w-5" />;
    if (messageType === "agent") return <RocketIcon className="h-5 w-5" />;
    return <InfoCircledIcon className="h-5 w-5" />;
  };

  return (
    <div
      className={cn(
        "flex w-full mb-5 items-start",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar for non-user messages */}
      {!isUser && (
        <Avatar className={cn(
          "h-8 w-8 mr-3",
          isSystem ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"
        )}>
          <AvatarFallback>{getInitial(type, agentId)}</AvatarFallback>
          {getIcon(type)}
        </Avatar>
      )}
      
      <div
        className={cn(
          "max-w-[85%] px-4 py-3 rounded-lg",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none shadow-md"
            : isAgent
            ? "bg-card text-card-foreground rounded-tl-none shadow-sm"
            : "bg-muted/50 text-muted-foreground text-sm w-fit max-w-full text-center shadow-sm"
        )}
      >
        {/* Show agent ID as a badge/tag */}
        {isAgent && agentId && (
          <div className="text-xs font-medium bg-secondary/30 px-2 py-0.5 rounded-full inline-block mb-2">
            {agentId}
          </div>
        )}
        
        <div className={cn(
          "whitespace-pre-wrap",
          isSystem && "italic"
        )}>
          {isLoading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : (
            content
          )}
        </div>
        
        {timestamp && (
          <div className="text-xs opacity-70 mt-2 flex justify-end">
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>
      
      {/* Avatar for user messages */}
      {isUser && (
        <Avatar className="h-8 w-8 ml-3 bg-primary text-primary-foreground">
          <AvatarFallback>U</AvatarFallback>
          <PersonIcon className="h-5 w-5" />
        </Avatar>
      )}
    </div>
  );
} 