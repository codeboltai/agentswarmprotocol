"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRegistry = void 0;
const uuid_1 = require("uuid");
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
     * @returns {Array<Service>} Array of service objects
     */
    getAllServices(filters = {}) {
        let result = Array.from(this.services.values());
        // Filter by status
        if (filters.status) {
            result = result.filter(service => service.status === filters.status);
        }
        // Filter by capabilities
        if (filters.capabilities && filters.capabilities.length) {
            result = result.filter(service => {
                return filters.capabilities.every((capability) => service.capabilities && service.capabilities.includes(capability));
            });
        }
        return result;
    }
    /**
     * Get a service by ID
     * @param {string} serviceId - ID of the service to get
     * @returns {Service|undefined} Service object or undefined if not found
     */
    getServiceById(serviceId) {
        return this.services.get(serviceId);
    }
    /**
     * Get a service by name
     * @param {string} serviceName - Name of the service to get
     * @returns {Service|undefined} Service object or undefined if not found
     */
    getServiceByName(serviceName) {
        for (const service of this.services.values()) {
            if (service.name.toLowerCase() === serviceName.toLowerCase()) {
                return service;
            }
        }
        return undefined;
    }
    /**
     * Get a service ID by connection ID
     * @param {string} connectionId - WebSocket connection ID
     * @returns {string|undefined} Service ID or undefined if not found
     */
    getServiceIdByConnectionId(connectionId) {
        return this.connectionToServiceId.get(connectionId);
    }
    /**
     * Get a service by connection ID
     * @param {string} connectionId - WebSocket connection ID
     * @returns {Service|undefined} Service object or undefined if not found
     */
    getServiceByConnectionId(connectionId) {
        const serviceId = this.getServiceIdByConnectionId(connectionId);
        if (!serviceId)
            return undefined;
        return this.getServiceById(serviceId);
    }
    /**
     * Get services by capability
     * @param {string} capability - Capability to search for
     * @returns {Array<Service>} Array of services with the capability
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
     * @param {Service} serviceInfo - Service information
     * @returns {Service} Registered service
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
        const serviceId = serviceInfo.id || (0, uuid_1.v4)();
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
     * @param {Service} serviceInfo - Service information
     * @returns {Service} Updated service
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
     * @returns {Service|undefined} The disconnected service or undefined if not found
     */
    handleDisconnection(connectionId) {
        const serviceId = this.connectionToServiceId.get(connectionId);
        if (!serviceId) {
            return undefined;
        }
        // Get the service
        const service = this.services.get(serviceId);
        if (!service) {
            return undefined;
        }
        // Update service status
        const updatedService = {
            ...service,
            status: 'offline',
            connectionId: '' // Empty string as TypeScript doesn't allow null for connectionId
        };
        // Update the service
        this.services.set(serviceId, updatedService);
        // Remove the connection mapping
        this.connectionToServiceId.delete(connectionId);
        return updatedService;
    }
    /**
     * Update a service's status
     * @param {string} serviceId - The ID of the service to update
     * @param {ServiceStatus} status - The new status
     * @param {any} details - Optional status details
     * @returns {Service|undefined} The updated service or undefined if not found
     */
    updateServiceStatus(serviceId, status, details) {
        const service = this.getServiceById(serviceId);
        if (!service) {
            return undefined;
        }
        service.status = status;
        // Add status details if provided
        if (details) {
            service.statusDetails = details;
        }
        this.services.set(serviceId, service);
        return service;
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
     * @param {ServiceConfiguration} config - Service configuration
     */
    setServiceConfiguration(serviceId, config) {
        const serviceConfig = {
            id: serviceId,
            name: config.name || `Service-${serviceId}`,
            capabilities: config.capabilities || [],
            metadata: config.metadata || {},
            configuredAt: new Date().toISOString()
        };
        this.serviceConfigurations.set(serviceId, serviceConfig);
    }
    /**
     * Get service configuration
     * @param {string} serviceId - ID of the service
     * @returns {ServiceConfiguration|undefined} Service configuration or undefined if not found
     */
    getServiceConfiguration(serviceId) {
        return this.serviceConfigurations.get(serviceId);
    }
    /**
     * Get all service configurations
     * @returns {Array<ServiceConfiguration>} Array of service configurations
     */
    getAllServiceConfigurations() {
        return Array.from(this.serviceConfigurations.entries()).map(([id, config]) => {
            // Create a copy of the config without the id property to avoid duplication
            const { id: _, ...configWithoutId } = config;
            return {
                id,
                ...configWithoutId
            };
        });
    }
}
exports.ServiceRegistry = ServiceRegistry;
