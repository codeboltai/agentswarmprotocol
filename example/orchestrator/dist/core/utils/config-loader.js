"use strict";
/**
 * Configuration Loader for Agent Swarm Protocol
 * Loads configurations for MCP servers, agents, and orchestrator settings
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ConfigLoader {
    /**
     * Create a new ConfigLoader instance
     * @param options - Configuration options
     */
    constructor(options = {}) {
        // Parse command line arguments if not provided
        this.cliArgs = options.cliArgs || this.parseCommandLineArgs();
        // Try to resolve the path from CLI args, options, or default locations
        if (this.cliArgs.config && typeof this.cliArgs.config === 'string') {
            this.configPath = this.cliArgs.config;
            console.log(`Using configuration file from command line: ${this.configPath}`);
        }
        else if (options.configPath) {
            this.configPath = options.configPath;
        }
        else {
            // Default path: try to find in several locations
            const possiblePaths = [
                path_1.default.resolve(process.cwd(), 'configs/orchestrator-config.json'),
                path_1.default.resolve(process.cwd(), '../configs/orchestrator-config.json'),
                path_1.default.resolve(process.cwd(), '../../configs/orchestrator-config.json'),
                path_1.default.resolve(__dirname, '../../../../configs/orchestrator-config.json')
            ];
            // Use the first path that exists
            this.configPath = possiblePaths.find(p => {
                try {
                    return fs_1.default.existsSync(p);
                }
                catch (e) {
                    return false;
                }
            }) || possiblePaths[0]; // Default to the first path if none exist
        }
        console.log(`Will look for configuration file at: ${this.configPath}`);
        this.config = null;
    }
    /**
     * Parse command line arguments
     * @returns Parsed command line arguments
     */
    parseCommandLineArgs() {
        const args = process.argv.slice(2);
        const result = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('--')) {
                    result[key] = nextArg;
                    i++; // Skip the value
                }
                else {
                    result[key] = true;
                }
            }
        }
        return result;
    }
    /**
     * Get the resolved configuration with CLI args, config file, environment variables and defaults
     * @param options Additional configuration options
     * @returns Fully resolved configuration
     */
    getResolvedConfig(options = {}) {
        // Ensure config is loaded
        if (!this.config) {
            this.loadConfig();
        }
        const orchestratorSettings = this.config?.orchestrator || this.getDefaultConfig().orchestrator;
        // Process CLI arguments
        const portFromCli = this.cliArgs.agentPort && typeof this.cliArgs.agentPort === 'string'
            ? parseInt(this.cliArgs.agentPort, 10)
            : undefined;
        const clientPortFromCli = this.cliArgs.clientPort && typeof this.cliArgs.clientPort === 'string'
            ? parseInt(this.cliArgs.clientPort, 10)
            : undefined;
        const servicePortFromCli = this.cliArgs.servicePort && typeof this.cliArgs.servicePort === 'string'
            ? parseInt(this.cliArgs.servicePort, 10)
            : undefined;
        const logLevelFromCli = this.cliArgs.logLevel && typeof this.cliArgs.logLevel === 'string'
            ? this.cliArgs.logLevel
            : undefined;
        // Priority: CLI args > provided options > config file > environment vars > defaults
        return {
            port: portFromCli ||
                options.port ||
                orchestratorSettings.agentPort ||
                Number(process.env.PORT) ||
                3000,
            clientPort: clientPortFromCli ||
                options.clientPort ||
                orchestratorSettings.clientPort ||
                Number(process.env.CLIENT_PORT) ||
                3001,
            servicePort: servicePortFromCli ||
                options.servicePort ||
                orchestratorSettings.servicePort ||
                Number(process.env.SERVICE_PORT) ||
                3002,
            logLevel: logLevelFromCli ||
                options.logLevel ||
                orchestratorSettings.logLevel ||
                process.env.LOG_LEVEL ||
                'info'
        };
    }
    /**
     * Load the configuration file
     * @returns The loaded configuration
     */
    loadConfig() {
        try {
            if (!fs_1.default.existsSync(this.configPath)) {
                console.warn(`Configuration file not found at ${this.configPath}, using defaults`);
                console.log(`Current working directory: ${process.cwd()}`);
                this.config = this.getDefaultConfig();
                return this.config;
            }
            console.log(`Reading configuration file from: ${this.configPath}`);
            const configData = fs_1.default.readFileSync(this.configPath, 'utf8');
            const parsedConfig = JSON.parse(configData);
            // Initialize with defaults and merge with parsed config
            this.config = {
                mcpServers: {},
                agents: {},
                services: {},
                orchestrator: {
                    agentPort: 3000,
                    clientPort: 3001,
                    logLevel: 'info',
                    taskTimeout: 300000
                },
                ...parsedConfig
            };
            console.log(`Successfully loaded configuration from ${this.configPath}`);
            // Log the MCP servers and agents found
            const mcpServerCount = Object.keys(this.config.mcpServers).length;
            const agentCount = Object.keys(this.config.agents).length;
            const serviceCount = Object.keys(this.config.services).length;
            console.log(`Configuration contains ${mcpServerCount} MCP server(s), ${agentCount} agent(s), and ${serviceCount} service(s)`);
            if (mcpServerCount > 0) {
                console.log(`MCP Servers found: ${Object.keys(this.config.mcpServers).join(', ')}`);
            }
            return this.config;
        }
        catch (error) {
            console.error(`Error loading configuration: ${error instanceof Error ? error.message : String(error)}`);
            if (error instanceof Error) {
                console.error(error.stack);
            }
            this.config = this.getDefaultConfig();
            return this.config;
        }
    }
    /**
     * Get MCP server configurations
     * @returns MCP server configurations
     */
    getMCPServers() {
        if (!this.config) {
            this.loadConfig();
        }
        // Convert from object to array format
        const config = this.config || this.getDefaultConfig();
        const servers = config.mcpServers;
        return Object.keys(servers).map(name => ({
            name,
            ...servers[name]
        }));
    }
    /**
     * Get agent configurations
     * @returns Agent configurations
     */
    getAgentConfigurations() {
        if (!this.config) {
            this.loadConfig();
        }
        const config = this.config || this.getDefaultConfig();
        return config.agents;
    }
    /**
     * Get service configurations
     * @returns Service configurations
     */
    getServiceConfigurations() {
        if (!this.config) {
            this.loadConfig();
        }
        const config = this.config || this.getDefaultConfig();
        return config.services;
    }
    /**
     * Get orchestrator settings
     * @returns Orchestrator settings
     */
    getOrchestratorSettings() {
        if (!this.config) {
            this.loadConfig();
        }
        const config = this.config || this.getDefaultConfig();
        return config.orchestrator;
    }
    /**
     * Get the default configuration
     * @returns Default configuration
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
     * @param options - Options to merge with the configuration
     * @returns Merged configuration
     */
    mergeWithOptions(options = {}) {
        if (!this.config) {
            this.loadConfig();
        }
        const config = this.config || this.getDefaultConfig();
        const merged = { ...config };
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
exports.default = ConfigLoader;
