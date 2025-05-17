/**
 * Agent interface for agent data returned from the orchestrator
 */
export interface Agent {
    /** Unique agent ID */
    id: string;
    /** Agent name */
    name: string;
    /** Agent capabilities/functions */
    capabilities: string[];
    /** Current agent status */
    status: string;
    /** Optional agent description */
    description?: string;
}
/**
 * Agent filter options
 */
export interface AgentFilters {
    /** Filter by agent status */
    status?: string;
    /** Filter by agent capabilities */
    capabilities?: string[];
    /** Filter by agent name (partial match) */
    name?: string;
}
/**
 * Task request options
 */
export interface TaskRequestOptions {
    /** Whether to wait for the task result */
    waitForResult?: boolean;
    /** Timeout in milliseconds */
    timeout?: number;
}
