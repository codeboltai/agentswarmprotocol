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
    try {
      this.logger.debug(`Requesting service "${serviceName}" with params:`, params);
      
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to request service "${serviceName}": ${errorMessage}`);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
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
    const { timeout = 30000, clientId } = options;
    const requestId = uuidv4();
    
    this.logger.debug(`Executing service task "${functionName}" on service "${serviceId}" with params:`, params);
    
    try {
      // Make the request
      const response = await this.webSocketManager.sendAndWaitForResponse({
        id: requestId,
        type: 'service.task.execute',
        content: {
          serviceId,
          functionName,
          params,
          clientId,
          // Include timestamp for tracking
          timestamp: new Date().toISOString()
        }
      } as BaseMessage, timeout);
      
      if (response.content && response.content.error) {
        throw new Error(response.content.error);
      }
      
      return response.content.result;
    } catch (error: unknown) {
      // Enhance error handling for connection issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Connection not found')) {
        this.logger.error(`Service connection error: Unable to find service "${serviceId}"`);
        throw new Error(`Connection not found for service "${serviceId}". Ensure the service is running and properly registered.`);
      }
      
      if (errorMessage.includes('timed out')) {
        this.logger.error(`Service task timed out: "${functionName}" on service "${serviceId}" after ${timeout}ms`);
        throw new Error(`Service task "${functionName}" timed out after ${timeout}ms. The service might be unresponsive.`);
      }
      
      this.logger.error(`Failed to execute service task "${functionName}" on service "${serviceId}": ${errorMessage}`);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  /**
   * Get a list of available services
   * @param filters Filter criteria
   */
  async getServiceList(filters: Record<string, any> = {}): Promise<any[]> {
    try {
      this.logger.debug(`Getting service list with filters:`, filters);
      
      const response = await this.webSocketManager.sendAndWaitForResponse({
        id: uuidv4(),
        type: 'service.list',
        content: { filters }
      } as BaseMessage);
      
      return response.content.services || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get service list: ${errorMessage}`);
      
      // Return empty array instead of throwing on service list failures
      // This allows the application to continue even if service discovery fails
      return [];
    }
  }
} 