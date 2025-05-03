import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceNotification } from '../core/types';

export class NotificationManager {
  constructor(
    private webSocketManager: WebSocketManager,
    private serviceId: string,
    private logger: Console = console
  ) {}

  /**
   * Send a general notification to clients
   * @param notification Notification data
   */
  async notify(notification: any): Promise<void> {
    if (!notification.timestamp) {
      notification.timestamp = new Date().toISOString();
    }
    
    if (!notification.type) {
      notification.type = 'info';
    }
    
    await this.sendNotification(notification);
  }

  /**
   * Send a notification to the orchestrator
   * @param notification Notification data
   */
  async sendNotification(notification: ServiceNotification | any): Promise<void> {
    await this.webSocketManager.send({
      id: uuidv4(),
      type: 'service.notification',
      content: {
        serviceId: this.serviceId,
        notification
      }
    } as BaseMessage);
  }
} 