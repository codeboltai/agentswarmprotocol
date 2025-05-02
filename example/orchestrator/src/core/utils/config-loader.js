/**
 * Configuration Loader for Agent Swarm Protocol
 * Loads configurations for MCP servers, agents, and orchestrator settings
 */

const fs = require('fs');
const path = require('path');

class ConfigLoader {
  /**
   * Create a new ConfigLoader instance
   * @param {Object} options - Configuration options
   * @param {string} options.configPath - Path to the configuration file
   */
  constructor(options = {}) {
    // Try to resolve the path relative to the project root directory
    if (options.configPath) {
      this.configPath = options.configPath;
    } else {
      // Default path: try to find in several locations
      const possiblePaths = [
        path.resolve(process.cwd(), 'configs/orchestrator-config.json'),
        path.resolve(process.cwd(), '../configs/orchestrator-config.json'),
        path.resolve(process.cwd(), '../../configs/orchestrator-config.json'),
        path.resolve(__dirname, '../../../../configs/orchestrator-config.json')
      ];

      // Use the first path that exists
      this.configPath = possiblePaths.find(p => {
        try {
          return fs.existsSync(p);
        } catch (e) {
          return false;
        }
      }) || possiblePaths[0]; // Default to the first path if none exist
    }

    console.log(`Will look for configuration file at: ${this.configPath}`);
    this.config = null;
  }

  /**
   * Load the configuration file
   * @returns {Object} The loaded configuration
   */
  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.warn(`Configuration file not found at ${this.configPath}, using defaults`);
        console.log(`Current working directory: ${process.cwd()}`);
        this.config = this.getDefaultConfig();
        return this.config;
      }

      console.log(`Reading configuration file from: ${this.configPath}`);
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log(`Successfully loaded configuration from ${this.configPath}`);
      
      // Log the MCP servers and agents found
      const mcpServerCount = Object.keys(this.config.mcpServers || {}).length;
      const agentCount = Object.keys(this.config.agents || {}).length;
      const serviceCount = Object.keys(this.config.services || {}).length;
      console.log(`Configuration contains ${mcpServerCount} MCP server(s), ${agentCount} agent(s), and ${serviceCount} service(s)`);
      
      if (mcpServerCount > 0) {
        console.log(`MCP Servers found: ${Object.keys(this.config.mcpServers || {}).join(', ')}`);
      }
      
      return this.config;
    } catch (error) {
      console.error(`Error loading configuration: ${error.message}`);
      console.error(error.stack);
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * Get MCP server configurations
   * @returns {Object} MCP server configurations
   */
  getMCPServers() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config.mcpServers || {};
  }

  /**
   * Get agent configurations
   * @returns {Object} Agent configurations
   */
  getAgents() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config.agents || {};
  }

  /**
   * Get service configurations
   * @returns {Object} Service configurations
   */
  getServices() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config.services || {};
  }

  /**
   * Get orchestrator settings
   * @returns {Object} Orchestrator settings
   */
  getOrchestratorSettings() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config.orchestrator || this.getDefaultConfig().orchestrator;
  }

  /**
   * Get the default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      mcpServers: {},
      agents: {},
      services: {},
      orchestrator: {
        agentPort: 3000,
        clientPort: 3001,
        logLevel: 'info',
        taskTimeout: 300000
      }
    };
  }

  /**
   * Merge configuration with provided options
   * @param {Object} options - Options to merge with the configuration
   * @returns {Object} Merged configuration
   */
  mergeWithOptions(options = {}) {
    if (!this.config) {
      this.loadConfig();
    }

    const merged = { ...this.config };

    // Merge orchestrator settings
    if (options.orchestrator) {
      merged.orchestrator = {
        ...merged.orchestrator,
        ...options.orchestrator
      };
    }

    // Merge MCP servers (adding new ones and updating existing)
    if (options.mcpServers) {
      merged.mcpServers = {
        ...merged.mcpServers,
        ...options.mcpServers
      };
    }

    // Merge agents (adding new ones and updating existing)
    if (options.agents) {
      merged.agents = {
        ...merged.agents,
        ...options.agents
      };
    }

    // Merge services (adding new ones and updating existing)
    if (options.services) {
      merged.services = {
        ...merged.services,
        ...options.services
      };
    }

    return merged;
  }
}

module.exports = ConfigLoader; 