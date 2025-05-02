const { v4: uuidv4 } = require('uuid');

/**
 * ServiceRegistry - Manages services connected to the orchestrator
 */
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.serviceConfigurations = new Map();
    this.connectionToServiceId = new Map();
  }

  /**
   * Get all registered services
   * @returns {Array} Array of service objects
   */
  getAllServices() {
    return Array.from(this.services.values());
  }

  /**
   * Get a service by ID
   * @param {string} serviceId - ID of the service to get
   * @returns {Object|null} Service object or null if not found
   */
  getServiceById(serviceId) {
    return this.services.get(serviceId) || null;
  }

  /**
   * Get a service by name
   * @param {string} serviceName - Name of the service to get
   * @returns {Object|null} Service object or null if not found
   */
  getServiceByName(serviceName) {
    for (const service of this.services.values()) {
      if (service.name.toLowerCase() === serviceName.toLowerCase()) {
        return service;
      }
    }
    return null;
  }

  /**
   * Get a service ID by connection ID
   * @param {string} connectionId - WebSocket connection ID
   * @returns {string|null} Service ID or null if not found
   */
  getServiceIdByConnectionId(connectionId) {
    return this.connectionToServiceId.get(connectionId) || null;
  }

  /**
   * Get services by capability
   * @param {string} capability - Capability to search for
   * @returns {Array} Array of services with the capability
   */
  getServicesByCapability(capability) {
    const result = [];
    for (const service of this.services.values()) {
      if (service.capabilities && service.capabilities.includes(capability)) {
        result.push(service);
      }
    }
    return result;
  }

  /**
   * Register a new service
   * @param {Object} serviceInfo - Service information
   * @returns {Object} Registered service
   */
  registerService(serviceInfo) {
    // Check if this service already exists
    if (serviceInfo.id && this.services.has(serviceInfo.id)) {
      // Update existing service
      const existingService = this.services.get(serviceInfo.id);
      const updatedService = { ...existingService, ...serviceInfo };
      this.services.set(serviceInfo.id, updatedService);
      
      // Update connection mapping if connection has changed
      if (serviceInfo.connectionId && existingService.connectionId !== serviceInfo.connectionId) {
        if (existingService.connectionId) {
          this.connectionToServiceId.delete(existingService.connectionId);
        }
        this.connectionToServiceId.set(serviceInfo.connectionId, serviceInfo.id);
      }
      
      return updatedService;
    }

    // Create a new service
    const serviceId = serviceInfo.id || uuidv4();
    const now = new Date().toISOString();
    
    // Check if we have a configuration for this service ID
    const config = this.serviceConfigurations.get(serviceId);
    
    const service = {
      id: serviceId,
      name: serviceInfo.name || (config ? config.name : `Service-${serviceId}`),
      status: serviceInfo.status || 'online',
      capabilities: serviceInfo.capabilities || (config ? config.capabilities : []),
      connectionId: serviceInfo.connectionId,
      registeredAt: now,
      manifest: serviceInfo.manifest || {}
    };

    // Store the service
    this.services.set(serviceId, service);
    
    // Map connection to service ID for quick lookup
    if (serviceInfo.connectionId) {
      this.connectionToServiceId.set(serviceInfo.connectionId, serviceId);
    }
    
    return service;
  }

  /**
   * Update service information
   * @param {Object} serviceInfo - Service information
   * @returns {Object} Updated service
   */
  updateService(serviceInfo) {
    // Make sure the service exists
    if (!serviceInfo.id || !this.services.has(serviceInfo.id)) {
      throw new Error(`Service not found: ${serviceInfo.id}`);
    }
    
    const existingService = this.services.get(serviceInfo.id);
    const updatedService = { ...existingService, ...serviceInfo };
    
    // Update the service
    this.services.set(serviceInfo.id, updatedService);
    
    // Update connection mapping if connection has changed
    if (serviceInfo.connectionId && existingService.connectionId !== serviceInfo.connectionId) {
      if (existingService.connectionId) {
        this.connectionToServiceId.delete(existingService.connectionId);
      }
      this.connectionToServiceId.set(serviceInfo.connectionId, serviceInfo.id);
    }
    
    return updatedService;
  }

  /**
   * Handle service disconnection
   * @param {string} connectionId - WebSocket connection ID
   * @returns {Object|null} The disconnected service or null if not found
   */
  handleDisconnection(connectionId) {
    const serviceId = this.connectionToServiceId.get(connectionId);
    if (!serviceId) {
      return null;
    }
    
    // Get the service
    const service = this.services.get(serviceId);
    if (!service) {
      return null;
    }
    
    // Update service status
    const updatedService = {
      ...service,
      status: 'offline',
      connectionId: null
    };
    
    // Update the service
    this.services.set(serviceId, updatedService);
    
    // Remove the connection mapping
    this.connectionToServiceId.delete(connectionId);
    
    return updatedService;
  }

  /**
   * Remove a service
   * @param {string} serviceId - ID of the service to remove
   * @returns {boolean} True if the service was removed, false otherwise
   */
  removeService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }
    
    // Remove connection mapping
    if (service.connectionId) {
      this.connectionToServiceId.delete(service.connectionId);
    }
    
    // Remove the service
    this.services.delete(serviceId);
    
    return true;
  }

  /**
   * Set service configuration for preconfigured services
   * @param {string} serviceId - ID of the service
   * @param {Object} config - Service configuration
   */
  setServiceConfiguration(serviceId, config) {
    this.serviceConfigurations.set(serviceId, config);
  }

  /**
   * Get service configuration
   * @param {string} serviceId - ID of the service
   * @returns {Object|null} Service configuration or null if not found
   */
  getServiceConfiguration(serviceId) {
    return this.serviceConfigurations.get(serviceId) || null;
  }

  /**
   * Get all service configurations
   * @returns {Array} Array of service configurations
   */
  getAllServiceConfigurations() {
    return Array.from(this.serviceConfigurations.entries()).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * Filter services based on criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered array of services
   */
  filterServices(filters = {}) {
    let result = this.getAllServices();
    
    // Filter by status
    if (filters.status) {
      result = result.filter(service => service.status === filters.status);
    }
    
    // Filter by capabilities
    if (filters.capabilities && filters.capabilities.length) {
      result = result.filter(service => {
        return filters.capabilities.every(capability => 
          service.capabilities && service.capabilities.includes(capability)
        );
      });
    }
    
    // Filter by name
    if (filters.name) {
      const nameLower = filters.name.toLowerCase();
      result = result.filter(service => 
        service.name.toLowerCase().includes(nameLower)
      );
    }
    
    return result;
  }
}

module.exports = { ServiceRegistry }; 