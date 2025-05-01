/**
 * Service Registry for the ASP Orchestrator
 * Manages registration of services that can be requested by agents
 */
class ServiceRegistry {
  constructor() {
    this.services = new Map(); // Maps service names to service objects
    this.servicesByAgentId = new Map(); // Maps agent IDs to lists of provided services
  }

  /**
   * Register a new service
   * @param {Object} service - Service details
   * @param {string} service.name - Name of the service
   * @param {string} service.description - Description of the service
   * @param {Object} service.schema - JSON Schema for service parameters
   * @param {string} service.providerId - ID of the agent providing this service
   * @returns {Object} The registered service
   */
  registerService(service) {
    if (!service.name) {
      throw new Error('Service name is required');
    }
    
    if (!service.providerId) {
      throw new Error('Provider agent ID is required');
    }
    
    // Create a unique service ID if not provided
    const serviceId = service.id || `${service.name}:${service.providerId}`;
    
    // Create the full service object
    const fullService = {
      ...service,
      id: serviceId,
      registeredAt: new Date().toISOString()
    };
    
    // Register the service
    this.services.set(serviceId, fullService);
    
    // Add to the provider's services list
    if (!this.servicesByAgentId.has(service.providerId)) {
      this.servicesByAgentId.set(service.providerId, []);
    }
    
    const agentServices = this.servicesByAgentId.get(service.providerId);
    if (!agentServices.some(s => s.id === serviceId)) {
      agentServices.push(fullService);
    }
    
    return fullService;
  }

  /**
   * Get a service by ID
   * @param {string} serviceId - ID of the service to get
   * @returns {Object|null} The service object or null if not found
   */
  getServiceById(serviceId) {
    return this.services.get(serviceId) || null;
  }

  /**
   * Get services by name
   * @param {string} serviceName - Name of the service
   * @returns {Array<Object>} Array of matching service objects
   */
  getServicesByName(serviceName) {
    return Array.from(this.services.values())
      .filter(service => service.name === serviceName);
  }

  /**
   * Get services provided by a specific agent
   * @param {string} agentId - ID of the provider agent
   * @returns {Array<Object>} Array of services provided by the agent
   */
  getServicesByProviderId(agentId) {
    return this.servicesByAgentId.get(agentId) || [];
  }

  /**
   * Get all registered services
   * @param {Object} options - Filter options
   * @param {string} options.category - Filter by service category
   * @returns {Array<Object>} List of matching services
   */
  getAllServices(options = {}) {
    let services = Array.from(this.services.values());
    
    // Filter by category if provided
    if (options.category) {
      services = services.filter(service => service.category === options.category);
    }
    
    return services;
  }

  /**
   * Remove a service by ID
   * @param {string} serviceId - ID of the service to remove
   * @returns {boolean} True if the service was removed, false otherwise
   */
  removeService(serviceId) {
    const service = this.getServiceById(serviceId);
    if (!service) {
      return false;
    }
    
    this.services.delete(serviceId);
    
    // Remove from the provider's services list
    const agentServices = this.servicesByAgentId.get(service.providerId);
    if (agentServices) {
      const index = agentServices.findIndex(s => s.id === serviceId);
      if (index !== -1) {
        agentServices.splice(index, 1);
      }
      
      // Clean up empty agent service lists
      if (agentServices.length === 0) {
        this.servicesByAgentId.delete(service.providerId);
      }
    }
    
    return true;
  }

  /**
   * Remove all services provided by an agent
   * @param {string} agentId - ID of the agent whose services should be removed
   * @returns {number} Number of services removed
   */
  removeServicesByProviderId(agentId) {
    const agentServices = this.getServicesByProviderId(agentId);
    const serviceIds = agentServices.map(service => service.id);
    
    let removedCount = 0;
    for (const serviceId of serviceIds) {
      if (this.removeService(serviceId)) {
        removedCount++;
      }
    }
    
    return removedCount;
  }

  /**
   * Find services that match given criteria
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.name - Service name to match
   * @param {string} criteria.category - Service category to match
   * @param {string} criteria.providerId - Provider agent ID to match
   * @returns {Array<Object>} List of matching services
   */
  findServices(criteria = {}) {
    let services = this.getAllServices();
    
    if (criteria.name) {
      services = services.filter(service => service.name === criteria.name);
    }
    
    if (criteria.category) {
      services = services.filter(service => service.category === criteria.category);
    }
    
    if (criteria.providerId) {
      services = services.filter(service => service.providerId === criteria.providerId);
    }
    
    return services;
  }

  /**
   * Get the total number of registered services
   * @returns {number} The number of services
   */
  getServiceCount() {
    return this.services.size;
  }
}

module.exports = { ServiceRegistry }; 