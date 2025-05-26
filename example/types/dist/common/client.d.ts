/**
 * Client Types for Agent Swarm Protocol
 */
/**
 * Client status types
 */
export type ClientStatus = 'online' | 'offline' | 'busy' | 'error';
/**
 * Client interface representing a client connected to the orchestrator
 */
export interface Client {
    /** Unique client ID */
    id: string;
    /** Client name */
    name?: string;
    /** Current client status */
    status: ClientStatus;
    /** Connection ID for the WebSocket */
    connectionId?: string;
    /** Additional client metadata */
    metadata?: Record<string, any>;
    /** When the client was registered */
    registeredAt: string;
    /** When the client was last active */
    lastActiveAt?: string;
}
/**
 * Client configuration interface
 */
export interface ClientConfiguration {
    /** Unique client ID */
    id: string;
    /** Client name */
    name?: string;
    /** Client metadata */
    metadata: Record<string, any>;
    /** When the configuration was set */
    configuredAt: string;
}
/**
 * Client filter options
 */
export interface ClientFilters {
    /** Filter by client status */
    status?: ClientStatus;
}
/**
 * Client registry interface
 */
export interface ClientRegistry {
    getAllClients(filters?: ClientFilters): Client[];
    getClientById(clientId: string): Client | undefined;
    getClientByName(clientName?: string): Client | undefined;
    getClientIdByConnectionId(connectionId: string): string | undefined;
    getClientByConnectionId(connectionId: string): Client | undefined;
    registerClient(clientInfo: Partial<Client>): Client;
    updateClient(clientInfo: Partial<Client> & {
        id: string;
    }): Client;
    handleDisconnection(connectionId: string): Client | undefined;
    updateClientStatus(clientId: string, status: ClientStatus): Client | undefined;
    removeClient(clientId: string): boolean;
    setClientConfiguration(clientId: string, config: Partial<ClientConfiguration>): void;
    getClientConfiguration(clientId: string): ClientConfiguration | undefined;
    getAllClientConfigurations(): ClientConfiguration[];
}
//# sourceMappingURL=client.d.ts.map