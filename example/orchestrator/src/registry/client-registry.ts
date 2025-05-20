/**
 * Client Registry for the ASP Orchestrator
 * Responsible for managing client registrations and connections
 */

import { v4 as uuidv4 } from 'uuid';

export interface Client {
  id: string;
  name?: string;
  status: ClientStatus;
  connectionId?: string;
  metadata?: Record<string, any>;
  registeredAt: string;
  lastActiveAt?: string;
}

export type ClientStatus = 'online' | 'offline' | 'busy' | 'error';

interface ClientConfiguration {
  id: string;
  name?: string;
  metadata: Record<string, any>;
  configuredAt: string;
}

/**
 * ClientRegistry - Manages clients connected to the orchestrator
 */
export class ClientRegistry {
  private clients: Map<string, Client>;
  private clientConfigurations: Map<string, ClientConfiguration>;
  private connectionToClientId: Map<string, string>;

  constructor() {
    this.clients = new Map();
    this.clientConfigurations = new Map();
    this.connectionToClientId = new Map();
  }

  /**
   * Get all registered clients
   * @returns {Array<Client>} Array of client objects
   */
  getAllClients(filters: { status?: ClientStatus } = {}): Client[] {
    let result = Array.from(this.clients.values());
    
    // Filter by status
    if (filters.status) {
      result = result.filter(client => client.status === filters.status);
    }
    
    return result;
  }

  /**
   * Get a client by ID
   * @param {string} clientId - ID of the client to get
   * @returns {Client|undefined} Client object or undefined if not found
   */
  getClientById(clientId: string): Client | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get a client by name
   * @param {string} clientName - Name of the client to get
   * @returns {Client|undefined} Client object or undefined if not found
   */
  getClientByName(clientName?: string): Client | undefined {
    if (!clientName) return undefined;
    
    for (const client of this.clients.values()) {
      if (client.name?.toLowerCase() === clientName.toLowerCase()) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Get a client ID by connection ID
   * @param {string} connectionId - WebSocket connection ID
   * @returns {string|undefined} Client ID or undefined if not found
   */
  getClientIdByConnectionId(connectionId: string): string | undefined {
    return this.connectionToClientId.get(connectionId);
  }

  /**
   * Get a client by connection ID
   * @param {string} connectionId - WebSocket connection ID
   * @returns {Client|undefined} Client object or undefined if not found
   */
  getClientByConnectionId(connectionId: string): Client | undefined {
    const clientId = this.getClientIdByConnectionId(connectionId);
    if (!clientId) return undefined;
    return this.getClientById(clientId);
  }

  /**
   * Register a new client
   * @param {Partial<Client>} clientInfo - Client information
   * @returns {Client} Registered client
   */
  registerClient(clientInfo: Partial<Client>): Client {
    // Check if this client already exists
    if (clientInfo.id && this.clients.has(clientInfo.id)) {
      // Update existing client
      const existingClient = this.clients.get(clientInfo.id)!;
      const updatedClient = { ...existingClient, ...clientInfo };
      this.clients.set(clientInfo.id, updatedClient);
      
      // Update connection mapping if connection has changed
      if (clientInfo.connectionId && existingClient.connectionId !== clientInfo.connectionId) {
        if (existingClient.connectionId) {
          this.connectionToClientId.delete(existingClient.connectionId);
        }
        this.connectionToClientId.set(clientInfo.connectionId, clientInfo.id);
      }
      
      return updatedClient;
    }

    // Create a new client
    const clientId = clientInfo.id || uuidv4();
    const now = new Date().toISOString();
    
    // Check if we have a configuration for this client ID
    const config = this.clientConfigurations.get(clientId);
    
    const client: Client = {
      id: clientId,
      name: clientInfo.name || (config ? config.name : undefined),
      status: clientInfo.status || 'online',
      connectionId: clientInfo.connectionId,
      registeredAt: now,
      lastActiveAt: now,
      metadata: clientInfo.metadata || (config ? config.metadata : {})
    };

    // Store the client
    this.clients.set(clientId, client);
    
    // Map connection to client ID for quick lookup
    if (clientInfo.connectionId) {
      this.connectionToClientId.set(clientInfo.connectionId, clientId);
    }
    
    return client;
  }

  /**
   * Update client information
   * @param {Partial<Client>} clientInfo - Client information to update
   * @returns {Client} Updated client
   */
  updateClient(clientInfo: Partial<Client> & { id: string }): Client {
    // Make sure the client exists
    if (!clientInfo.id || !this.clients.has(clientInfo.id)) {
      throw new Error(`Client not found: ${clientInfo.id}`);
    }
    
    const existingClient = this.clients.get(clientInfo.id)!;
    const updatedClient = { ...existingClient, ...clientInfo };
    
    // Update the client
    this.clients.set(clientInfo.id, updatedClient);
    
    // Update connection mapping if connection has changed
    if (clientInfo.connectionId && existingClient.connectionId !== clientInfo.connectionId) {
      if (existingClient.connectionId) {
        this.connectionToClientId.delete(existingClient.connectionId);
      }
      this.connectionToClientId.set(clientInfo.connectionId, clientInfo.id);
    }
    
    // Update lastActiveAt
    updatedClient.lastActiveAt = new Date().toISOString();
    
    return updatedClient;
  }

  /**
   * Handle client disconnection
   * @param {string} connectionId - WebSocket connection ID
   * @returns {Client|undefined} The disconnected client or undefined if not found
   */
  handleDisconnection(connectionId: string): Client | undefined {
    const clientId = this.connectionToClientId.get(connectionId);
    if (!clientId) {
      return undefined;
    }
    
    // Get the client
    const client = this.clients.get(clientId);
    if (!client) {
      return undefined;
    }
    
    // Update client status
    const updatedClient: Client = {
      ...client,
      status: 'offline',
      connectionId: undefined,
      lastActiveAt: new Date().toISOString()
    };
    
    // Update the client
    this.clients.set(clientId, updatedClient);
    
    // Remove the connection mapping
    this.connectionToClientId.delete(connectionId);
    
    return updatedClient;
  }

  /**
   * Update a client's status
   * @param {string} clientId - The ID of the client to update
   * @param {ClientStatus} status - The new status
   * @returns {Client|undefined} The updated client or undefined if not found
   */
  updateClientStatus(clientId: string, status: ClientStatus): Client | undefined {
    const client = this.getClientById(clientId);
    if (!client) {
      return undefined;
    }
    
    client.status = status;
    client.lastActiveAt = new Date().toISOString();
    
    this.clients.set(clientId, client);
    
    return client;
  }

  /**
   * Remove a client
   * @param {string} clientId - ID of the client to remove
   * @returns {boolean} True if the client was removed, false otherwise
   */
  removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    // Remove connection mapping
    if (client.connectionId) {
      this.connectionToClientId.delete(client.connectionId);
    }
    
    // Remove client
    this.clients.delete(clientId);
    
    return true;
  }

  /**
   * Set client configuration
   * @param {string} clientId - ID of the client to configure
   * @param {Partial<ClientConfiguration>} config - Configuration to set
   */
  setClientConfiguration(clientId: string, config: Partial<ClientConfiguration>): void {
    const existingConfig = this.clientConfigurations.get(clientId) || {
      id: clientId,
      metadata: {},
      configuredAt: new Date().toISOString()
    };
    
    const updatedConfig = {
      ...existingConfig,
      ...config,
      configuredAt: new Date().toISOString()
    };
    
    this.clientConfigurations.set(clientId, updatedConfig as ClientConfiguration);
  }

  /**
   * Get client configuration
   * @param {string} clientId - ID of the client
   * @returns {ClientConfiguration|undefined} Configuration for the client
   */
  getClientConfiguration(clientId: string): ClientConfiguration | undefined {
    return this.clientConfigurations.get(clientId);
  }

  /**
   * Get all client configurations
   * @returns {ClientConfiguration[]} Array of client configurations
   */
  getAllClientConfigurations(): ClientConfiguration[] {
    return Array.from(this.clientConfigurations.values());
  }
} 