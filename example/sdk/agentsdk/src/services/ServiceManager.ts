import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@agentswarmprotocol/types/common';
import { WebSocketManager } from '../core/WebSocketManager';
import { ServiceTaskOptions } from '../core/types';

export class ServiceManager {
  constructor(
    private webSocketManager: WebSocketManager,
    private logger: Console = console
  ) {}

  /**
   * Request or execute a service
   * @param serviceName Name of the service
   * @param params Service parameters
   * @param timeout Request timeout
   */
  async requestService(serviceName: string, params: Record<string, any> = {}, timeout = 30000): Promise<any> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'service.request',
      content: {
        service: serviceName,
        params
      }
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.result;
  }

  /**
   * Execute a service task
   * @param serviceId Service ID or name
   * @param functionName Function name
   * @param params Parameters
   * @param options Additional options
   */
  async executeServiceTask(
    serviceId: string,
    functionName: string,
    params: Record<string, any> = {},
    options: ServiceTaskOptions = {}
  ): Promise<any> {
    const { timeout = 30000, onNotification, clientId } = options;
    const requestId = uuidv4();
    
    // Setup notification handling if provided
    if (onNotification) {
      const notificationHandler = (notificationMessage: any) => {
        // Check if this notification is for our request
        if (notificationMessage.requestId === requestId) {
          onNotification(notificationMessage);
          
          // If completed or failed, remove the listener
          if (
            notificationMessage.status === 'completed' || 
            notificationMessage.status === 'failed'
          ) {
            this.webSocketManager.removeListener('service.task.notification', notificationHandler);
          }
        }
      };
      
      this.webSocketManager.on('service.task.notification', notificationHandler);
    }
    
    // Make the request
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: requestId,
      type: 'service.task.execute',
      content: {
        serviceId,
        functionName,
        params,
        clientId
      }
    } as BaseMessage, timeout);
    
    if (response.content.error) {
      throw new Error(response.content.error);
    }
    
    return response.content.result;
  }

  /**
   * Get a list of available services
   * @param filters Filter criteria
   */
  async getServiceList(filters: Record<string, any> = {}): Promise<any[]> {
    const response = await this.webSocketManager.sendAndWaitForResponse({
      id: uuidv4(),
      type: 'service.list',
      content: { filters }
    } as BaseMessage);
    
    return response.content.services || [];
  }
} 