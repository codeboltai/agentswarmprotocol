import chalk from 'chalk';
import { LogLevel, MessageDirection } from '@agentswarmprotocol/types/common';

// Re-export for backward compatibility
export { LogLevel, MessageDirection };

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private getDirectionColor(direction: MessageDirection): chalk.Chalk {
    switch (direction) {
      case MessageDirection.AGENT_TO_ORCHESTRATOR:
        return chalk.cyan;
      case MessageDirection.ORCHESTRATOR_TO_AGENT:
        return chalk.blue;
      case MessageDirection.CLIENT_TO_ORCHESTRATOR:
        return chalk.green;
      case MessageDirection.ORCHESTRATOR_TO_CLIENT:
        return chalk.magenta;
      case MessageDirection.SERVICE_TO_ORCHESTRATOR:
        return chalk.yellow;
      case MessageDirection.ORCHESTRATOR_TO_SERVICE:
        return chalk.yellowBright;
      case MessageDirection.AGENT_TO_AGENT:
        return chalk.cyanBright;
      case MessageDirection.MCP:
        return chalk.redBright;
      case MessageDirection.INTERNAL:
        return chalk.gray;
      case MessageDirection.SYSTEM:
        return chalk.greenBright;
      default:
        return chalk.white;
    }
  }

  private getLogLevelColor(level: LogLevel): chalk.Chalk {
    switch (level) {
      case LogLevel.ERROR:
        return chalk.red;
      case LogLevel.WARN:
        return chalk.yellow;
      case LogLevel.INFO:
        return chalk.blue;
      case LogLevel.DEBUG:
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  private formatTimestamp(): string {
    return chalk.gray(`[${new Date().toISOString()}]`);
  }

  private formatDirection(direction: MessageDirection): string {
    const color = this.getDirectionColor(direction);
    return color(`[${direction}]`);
  }

  private formatLogLevel(level: LogLevel): string {
    const color = this.getLogLevelColor(level);
    return color(`[${level.toUpperCase()}]`);
  }

  public log(
    level: LogLevel,
    direction: MessageDirection,
    message: string,
    data?: any,
    entityId?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const directionFormatted = this.formatDirection(direction);
    const levelFormatted = this.formatLogLevel(level);
    
    let entityInfo = '';
    if (entityId) {
      entityInfo = chalk.magenta(`[${entityId}]`);
    }

    const logMessage = `${directionFormatted} ${levelFormatted} ${entityInfo} ${message}`;
    
    console.log(logMessage);
    
    if (data) {
      if (this.logLevel === LogLevel.DEBUG) {
        // Full detailed data in debug mode with gray formatting and better structure
        console.log(chalk.gray('  ┌─ Data:'));
        const formattedData = JSON.stringify(data, null, 2)
          .split('\n')
          .map((line, index, array) => {
            const prefix = index === array.length - 1 ? '  └─ ' : '  │  ';
            return chalk.gray(`${prefix}${line}`);
          })
          .join('\n');
        console.log(formattedData);
      } else if (this.logLevel === LogLevel.INFO) {
        // Compact data display for info mode with gray formatting and visual separator
        const compactData = JSON.stringify(data);
        if (compactData.length > 100) {
          // For longer data, format it nicely
          console.log(chalk.gray('  ┌─ Data:'));
          console.log(chalk.gray(`  └─ ${compactData}`));
        } else {
          // For shorter data, keep it inline
          console.log(chalk.gray(`  → ${compactData}`));
        }
      }
    }
  }

  // Convenience methods for different directions
  public agentToOrchestrator(message: string, data?: any, agentId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.AGENT_TO_ORCHESTRATOR, message, data, agentId);
  }

  public orchestratorToAgent(message: string, data?: any, agentId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.ORCHESTRATOR_TO_AGENT, message, data, agentId);
  }

  public clientToOrchestrator(message: string, data?: any, clientId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.CLIENT_TO_ORCHESTRATOR, message, data, clientId);
  }

  public orchestratorToClient(message: string, data?: any, clientId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.ORCHESTRATOR_TO_CLIENT, message, data, clientId);
  }

  public serviceToOrchestrator(message: string, data?: any, serviceId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.SERVICE_TO_ORCHESTRATOR, message, data, serviceId);
  }

  public orchestratorToService(message: string, data?: any, serviceId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.ORCHESTRATOR_TO_SERVICE, message, data, serviceId);
  }

  public agentToAgent(message: string, data?: any, fromAgentId?: string, toAgentId?: string): void {
    const entityId = fromAgentId && toAgentId ? `${fromAgentId}->${toAgentId}` : fromAgentId || toAgentId;
    this.log(LogLevel.INFO, MessageDirection.AGENT_TO_AGENT, message, data, entityId);
  }

  public mcp(message: string, data?: any, serverId?: string): void {
    this.log(LogLevel.INFO, MessageDirection.MCP, message, data, serverId);
  }

  public internal(message: string, data?: any): void {
    this.log(LogLevel.INFO, MessageDirection.INTERNAL, message, data);
  }

  public system(message: string, data?: any): void {
    this.log(LogLevel.INFO, MessageDirection.SYSTEM, message, data);
  }

  public error(direction: MessageDirection, message: string, error?: any, entityId?: string): void {
    this.log(LogLevel.ERROR, direction, message, error, entityId);
  }

  public warn(direction: MessageDirection, message: string, data?: any, entityId?: string): void {
    this.log(LogLevel.WARN, direction, message, data, entityId);
  }

  public debug(direction: MessageDirection, message: string, data?: any, entityId?: string): void {
    this.log(LogLevel.DEBUG, direction, message, data, entityId);
  }

  // Connection status logging
  public connection(direction: MessageDirection, status: 'connected' | 'disconnected', entityId: string): void {
    const statusColor = status === 'connected' ? chalk.green : chalk.red;
    const message = `${statusColor(status.toUpperCase())} - ${entityId}`;
    this.log(LogLevel.INFO, direction, message, undefined, entityId);
  }

  // Task flow logging
  public taskFlow(
    direction: MessageDirection,
    action: string,
    taskId: string,
    fromEntity?: string,
    toEntity?: string
  ): void {
    let entityInfo = taskId;
    if (fromEntity && toEntity) {
      entityInfo = `${fromEntity}->${toEntity}:${taskId}`;
    } else if (fromEntity || toEntity) {
      entityInfo = `${fromEntity || toEntity}:${taskId}`;
    }
    
    this.log(LogLevel.INFO, direction, `Task ${action}`, undefined, entityInfo);
  }

  // Message type logging
  public messageType(
    direction: MessageDirection,
    messageType: string,
    entityId?: string,
    additionalInfo?: string
  ): void {
    const message = `Message: ${chalk.bold(messageType)}${additionalInfo ? ` - ${additionalInfo}` : ''}`;
    this.log(LogLevel.INFO, direction, message, undefined, entityId);
  }
}

// Export singleton instance
export const logger = Logger.getInstance(); 