import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, ServiceStatus } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';

export class StatusManager {
  constructor(
    private webSocketManager: WebSocketManager,
    private serviceId: string,
    private logger: Console = console
  ) {}

  /**
   * Set service status
   * @param status New status
   * @param message Status message
   */
  async setStatus(status: ServiceStatus, message = ''): Promise<void> {
    await this.webSocketManager.send({
      id: uuidv4(),
      type: 'service.status',
      content: {
        serviceId: this.serviceId,
        status,
        message,
        timestamp: new Date().toISOString()
      }
    } as BaseMessage);
  }
} 