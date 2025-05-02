declare module '@agentswarmprotocol/clientsdk' {
  interface ClientConfig {
    orchestratorUrl?: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    clientId?: string;
    autoConnect?: boolean;
  }

  interface ClientMessage {
    id?: string;
    type: string;
    content: any;
    [key: string]: any;
  }

  class SwarmClientSDK {
    constructor(config?: ClientConfig);
    
    orchestratorUrl: string;
    autoReconnect: boolean;
    reconnectInterval: number;
    pendingResponses: Map<string, any>;
    connected: boolean;
    clientId: string | null;
    ws: any;

    connect(): Promise<void>;
    disconnect(): void;
    handleMessage(message: ClientMessage): Promise<void>;
    send(message: ClientMessage): Promise<string | null>;
    sendAndWaitForResponse(message: ClientMessage, options?: { timeout?: number }): Promise<ClientMessage>;
    getAgents(filters?: any): Promise<any[]>;
    sendTask(agentName: string, taskData: any, options?: { waitForResult?: boolean, timeout?: number }): Promise<any>;
    getTaskStatus(taskId: string): Promise<any>;
    listMCPServers(filters?: any): Promise<any>;
    subscribeToNotifications(options: any, callback: (notification: any) => void): () => void;
    sendMessage(message: ClientMessage): Promise<any>;
    
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export default SwarmClientSDK;
} 