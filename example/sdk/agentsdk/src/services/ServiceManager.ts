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
   * Execute a service tool
   * @param serviceId Service ID or name
   * @param toolId Tool ID
   * @param params Parameters
   * @param options Additional options
   */
  async executeServiceTool(
    serviceId: string,
    toolId: string,
    params: Record<string, any> = {},
    options: ServiceTaskOptions = {}
  ): Promise<any> {
    const { timeout = 30000, clientId } = options;
    const requestId = uuidv4();
    
    this.logger.debug(`Executing service tool "${toolId}" on service "${serviceId}" with params:`, params);
    
    try {
      // Make the request
      const response = await this.webSocketManager.sendAndWaitForResponse({
        id: requestId,
        type: 'service.task.execute',
        content: {
          serviceId,
          toolId,
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
        this.logger.error(`Service tool timed out: "${toolId}" on service "${serviceId}" after ${timeout}ms`);
        throw new Error(`Service tool "${toolId}" timed out after ${timeout}ms. The service might be unresponsive.`);
      }
      
      this.logger.error(`Failed to execute service tool "${toolId}" on service "${serviceId}": ${errorMessage}`);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  /**
   * Execute a service task (legacy method - now uses toolId)
   * @param serviceId Service ID or name
   * @param toolName Tool name (used as toolId)
   * @param params Parameters
   * @param options Additional options
   */
  async executeServiceTask(
    serviceId: string,
    toolName: string,
    params: Record<string, any> = {},
    options: ServiceTaskOptions = {}
  ): Promise<any> {
    // Delegate to executeServiceTool for consistency
    return this.executeServiceTool(serviceId, toolName, params, options);
  }

  /**
   * Get a list of available services
   * @param filters Filter criteria
   */
  async getServiceList(filters: Record<string, any> = {}): Promise<any[]> {
    try {
      this.logger.debug(`Getting service list with filters:`, filters);
      
      const response = await this.webSocketManager.sendRequestWaitForResponse({
        id: uuidv4(),
        type: 'agent.service.list.request',
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

  /**
   * Get a list of tools for a specific service
   * @param serviceId Service ID or name
   * @param options Optional parameters (e.g., timeout)
   */
  async getServiceToolList(serviceId: string, options: { timeout?: number } = {}): Promise<any[]> {
    const { timeout = 30000 } = options;
    try {
      this.logger.debug(`Getting tool list for service: ${serviceId}`);
      const response = await this.webSocketManager.sendAndWaitForResponse({
        id: uuidv4(),
        type: 'service.tools.list',
        content: { serviceId }
      } as BaseMessage, timeout);
      return response.content.tools || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get service tool list for service ${serviceId}: ${errorMessage}`);
      return [];
    }
  }
} 