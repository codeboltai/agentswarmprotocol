/**
 * Task interfaces for the ASP Orchestrator
 */
import { TaskStatus } from '@agentswarmprotocol/types/dist/common';

interface TaskHistoryEntry {
  status: string;
  timestamp: string;
  note: string;
  agentId?: string;
}

interface TaskData {
  id?: string;
  type: string;
  name: string;
  description?: string;
  input?: any;
  requesterId?: string;
  assigneeId?: string;
  clientId?: string;
  status?: TaskStatus;
  result?: any;
  [key: string]: any;
}

interface Task {
  id: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  history: TaskHistoryEntry[];
  agentId: string;      // Required by the types package
  taskData: any;        // Required by the types package
  clientId?: string;
  completedAt?: string;
  result?: any;
  error?: any;
  assigneeId?: string;  // Added to handle existing code references
  [key: string]: any;   // Allow string indexing
}

interface TaskUpdateOptions {
  note?: string;
  result?: any;
  agentId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Task Registry for the ASP Orchestrator
 * Manages active and completed tasks in the system
 */
class AgentTaskRegistry {
  private tasks: Map<string, Task>;
  private tasksByAgentId: Map<string, string[]>;
  private tasksByClientId: Map<string, string[]>;
  private taskIdCounter: number;

  constructor() {
    this.tasks = new Map(); // Maps task IDs to task objects
    this.tasksByAgentId = new Map(); // Maps agent IDs to arrays of assigned task IDs
    this.tasksByClientId = new Map(); // Maps client IDs to arrays of requested task IDs
    this.taskIdCounter = 0; // Counter for generating unique task IDs
  }

  /**
   * Generate a unique task ID
   * @private
   * @returns {string} A unique task ID
   */
  private _generateTaskId(): string {
    return `task_${Date.now()}_${this.taskIdCounter++}`;
  }

  /**
   * Check if a task exists
   * @param {string} taskId - ID of the task to check
   * @returns {boolean} True if the task exists, false otherwise
   */
  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Register a task directly with given task ID (primarily for client tasks)
   * @param {string} taskId - ID of the task
   * @param {TaskData} taskData - Task details
   * @returns {Task} The registered task
   */
  registerTask(taskId: string, taskData: TaskData): Task {
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    const task: Task = {
      id: taskId,
      ...taskData,
      status: (taskData.status as TaskStatus) || 'pending',
      createdAt: taskData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        status: taskData.status || 'pending',
        timestamp: new Date().toISOString(),
        note: 'Task registered'
      }],
      agentId: taskData.assigneeId || taskData.agentId || '',
      taskData: taskData
    };
    
    this.tasks.set(taskId, task);
    
    // Track task by agent ID if present
    if (taskData.assigneeId) {
      this._assignTaskToAgent(taskId, taskData.assigneeId);
    }
    
    // Track task by client ID if present
    if (taskData.clientId) {
      this._assignTaskToClient(taskId, taskData.clientId);
    }
    
    return task;
  }

  /**
   * Create a new task
   * @param {TaskData} taskData - Task details
   * @returns {Task} The created task
   */
  createTask(taskData: TaskData): Task {
    if (!taskData.type) {
      throw new Error('Task type is required');
    }
    
    if (!taskData.name) {
      throw new Error('Task name is required');
    }
    
    const taskId = taskData.id || this._generateTaskId();
    
    const task: Task = {
      ...taskData,
      id: taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: 'Task created'
      }],
      agentId: taskData.assigneeId || taskData.agentId || '',
      taskData: taskData
    };
    
    this.tasks.set(taskId, task);
    
    // If assignee is specified, track task by agent ID
    if (taskData.assigneeId) {
      this._assignTaskToAgent(taskId, taskData.assigneeId);
    }
    
    // If client is specified, track task by client ID
    if (taskData.clientId) {
      this._assignTaskToClient(taskId, taskData.clientId);
    }
    
    return task;
  }

  /**
   * Assign a task to an agent
   * @param {string} taskId - ID of the task to assign
   * @param {string} agentId - ID of the agent to assign the task to
   * @returns {Task|null} The updated task or null if task not found
   */
  assignTask(taskId: string, agentId: string): Task | null {
    try {
      const task = this.getTask(taskId);
      
      // Update the task's assignee
      task.assigneeId = agentId;
      task.agentId = agentId;
      task.status = 'in_progress' as TaskStatus;
      task.updatedAt = new Date().toISOString();
      
      // Add status update to history
      task.history.push({
        status: 'assigned',
        timestamp: new Date().toISOString(),
        note: `Assigned to agent ${agentId}`
      });
      
      // Update the task assignment tracking
      this._assignTaskToAgent(taskId, agentId);
      
      return task;
    } catch (error) {
      console.warn(`Failed to assign task ${taskId} to agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Internal method to track task assignment to agent
   * @private
   * @param {string} taskId - ID of the task
   * @param {string} agentId - ID of the agent
   */
  private _assignTaskToAgent(taskId: string, agentId: string): void {
    if (!this.tasksByAgentId.has(agentId)) {
      this.tasksByAgentId.set(agentId, []);
    }
    
    const agentTasks = this.tasksByAgentId.get(agentId);
    if (agentTasks && !agentTasks.includes(taskId)) {
      agentTasks.push(taskId);
    }
  }

  /**
   * Internal method to track task creation by client
   * @private
   * @param {string} taskId - ID of the task
   * @param {string} clientId - ID of the client
   */
  private _assignTaskToClient(taskId: string, clientId: string): void {
    if (!this.tasksByClientId.has(clientId)) {
      this.tasksByClientId.set(clientId, []);
    }
    
    const clientTasks = this.tasksByClientId.get(clientId);
    if (clientTasks && !clientTasks.includes(taskId)) {
      clientTasks.push(taskId);
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId - ID of the task to get
   * @returns {Task} The task object
   * @throws {Error} If task is not found
   */
  getTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    return task;
  }

  /**
   * Get a task by ID with null fallback
   * @param {string} taskId - ID of the task to get
   * @returns {Task|null} The task object or null if not found
   */
  getTaskOrNull(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Alias for backward compatibility
   * @param {string} taskId - ID of the task to get
   * @returns {Task} The task object
   * @throws {Error} If task is not found
   */
  getTaskById(taskId: string): Task {
    return this.getTask(taskId);
  }

  /**
   * Update task status
   * @param {string} taskId - ID of the task to update
   * @param {string} status - New status for the task
   * @param {TaskUpdateOptions} options - Additional update options
   * @returns {Task|null} The updated task or null if task not found
   */
  updateTaskStatus(taskId: string, status: string, options: TaskUpdateOptions = {}): Task | null {
    try {
      const task = this.getTask(taskId);
      
      // Update task status - ensure it's a valid TaskStatus
      const validStatus = this.validateTaskStatus(status);
      task.status = validStatus;
      task.updatedAt = new Date().toISOString();
      
      // Process additionalresult data if provided
      if (options.result !== undefined) {
        task.result = options.result;
      }
      
      // If error is provided, add it to the result
      if (options.error) {
        task.result = task.result || {};
        task.result.error = options.error;
      }
      
      // If additional metadata is provided, add it to the result
      if (options.metadata) {
        task.result = task.result || {};
        task.result.metadata = { ...task.result.metadata, ...options.metadata };
      }
      
      // Add history entry
      const historyEntry: TaskHistoryEntry = {
        status,
        timestamp: new Date().toISOString(),
        note: options.note || `Status updated to ${status}`
      };
      
      // Add agent ID to history entry if provided
      if (options.agentId) {
        historyEntry.agentId = options.agentId;
      }
      
      task.history.push(historyEntry);
      
      return task;
    } catch (error) {
      console.warn(`Failed to update task ${taskId} status: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Validate and convert a string status to a valid TaskStatus
   * @private
   * @param {string} status - Status string to validate
   * @returns {TaskStatus} A valid TaskStatus
   */
  private validateTaskStatus(status: string): TaskStatus {
    const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'failed'];
    
    if (validStatuses.includes(status as TaskStatus)) {
      return status as TaskStatus;
    }
    
    // Map custom statuses to valid TaskStatus values
    switch (status) {
      case 'assigned':
      case 'started':
        return 'in_progress';
      case 'error':
        return 'failed';
      case 'done':
      case 'success':
        return 'completed';
      case 'waiting':
      case 'new':
        return 'pending';
      default:
        console.warn(`Invalid task status '${status}', defaulting to 'pending'`);
        return 'pending';
    }
  }

  /**
   * Get tasks assigned to an agent
   * @param {string} agentId - ID of the agent
   * @returns {Task[]} Array of tasks assigned to the agent
   */
  getTasksByAgentId(agentId: string): Task[] {
    const taskIds = this.tasksByAgentId.get(agentId) || [];
    return taskIds
      .map(taskId => this.getTask(taskId))
      .filter((task): task is Task => task !== null);
  }

  /**
   * Get tasks created by a client
   * @param {string} clientId - ID of the client
   * @returns {Task[]} Array of tasks created by the client
   */
  getTasksByClientId(clientId: string): Task[] {
    const taskIds = this.tasksByClientId.get(clientId) || [];
    return taskIds
      .map(taskId => this.getTask(taskId))
      .filter((task): task is Task => task !== null);
  }

  /**
   * Get all tasks with optional filtering
   * @param {Object} filters - Filters to apply to tasks
   * @returns {Task[]} Array of tasks matching the filters
   */
  getAllTasks(filters: Record<string, any> = {}): Task[] {
    let tasks = Array.from(this.tasks.values());
    
    // Apply filters if any
    if (Object.keys(filters).length > 0) {
      tasks = tasks.filter(task => {
        for (const [key, value] of Object.entries(filters)) {
          if (task[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    return tasks;
  }

  /**
   * Get all active tasks (not completed or failed)
   * @returns {Task[]} Array of active tasks
   */
  getActiveTasks(): Task[] {
    return this.getAllTasks()
      .filter(task => !['completed', 'failed', 'cancelled'].includes(task.status));
  }

  /**
   * Get all completed tasks
   * @returns {Task[]} Array of completed tasks
   */
  getCompletedTasks(): Task[] {
    return this.getAllTasks()
      .filter(task => ['completed', 'failed', 'cancelled'].includes(task.status));
  }

  /**
   * Remove a task from the registry
   * @param {string} taskId - ID of the task to remove
   * @returns {boolean} True if the task was removed, false otherwise
   */
  removeTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) {
      return false;
    }
    
    // Remove task from the maps
    this.tasks.delete(taskId);
    
    // Remove from agent tasks if assigned
    if (task.assigneeId) {
      const agentTasks = this.tasksByAgentId.get(task.assigneeId);
      if (agentTasks) {
        const index = agentTasks.indexOf(taskId);
        if (index !== -1) {
          agentTasks.splice(index, 1);
        }
        
        // Remove agent entry if no tasks left
        if (agentTasks.length === 0) {
          this.tasksByAgentId.delete(task.assigneeId);
        }
      }
    }
    
    // Remove from client tasks if created by a client
    if (task.clientId) {
      const clientTasks = this.tasksByClientId.get(task.clientId);
      if (clientTasks) {
        const index = clientTasks.indexOf(taskId);
        if (index !== -1) {
          clientTasks.splice(index, 1);
        }
        
        // Remove client entry if no tasks left
        if (clientTasks.length === 0) {
          this.tasksByClientId.delete(task.clientId);
        }
      }
    }
    
    return true;
  }

  /**
   * Add a note to a task
   * @param {string} taskId - ID of the task
   * @param {string} note - Note to add
   * @param {string|null} agentId - ID of the agent adding the note
   * @returns {Task|null} The updated task or null if task not found
   */
  addTaskNote(taskId: string, note: string, agentId: string | null = null): Task | null {
    try {
      const task = this.getTask(taskId);
      
      // Create history entry for the note
      const historyEntry: TaskHistoryEntry = {
        status: task.status, // Maintain current status
        timestamp: new Date().toISOString(),
        note: note
      };
      
      // Add agent ID if provided
      if (agentId) {
        historyEntry.agentId = agentId;
      }
      
      // Add to history
      task.history.push(historyEntry);
      
      // Update last modified time
      task.updatedAt = new Date().toISOString();
      
      return task;
    } catch (error) {
      console.warn(`Failed to add note to task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get the count of tasks based on optional filters
   * @param {Object} filters - Filters to apply to tasks
   * @returns {number} Number of tasks matching the filters
   */
  getTaskCount(filters: Record<string, any> = {}): number {
    return this.getAllTasks(filters).length;
  }

  /**
   * Get tasks with filtering
   * @param {object} filters - Filter criteria
   * @returns {Task[]} Array of tasks matching the filter criteria
   */
  getTasks(filters: {
    agentId?: string;
    clientId?: string;
    status?: TaskStatus | TaskStatus[];
    type?: string;
  } = {}): Task[] {
    let result = Array.from(this.tasks.values());
    
    // Filter by agent ID
    if (filters.agentId) {
      result = result.filter(task => 
        task.agentId === filters.agentId || 
        task.assigneeId === filters.agentId
      );
    }
    
    // Filter by client ID
    if (filters.clientId) {
      result = result.filter(task => task.clientId === filters.clientId);
    }
    
    // Filter by status, supporting both single status and array of statuses
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        result = result.filter(task => 
          filters.status && filters.status.includes(task.status)
        );
      } else {
        result = result.filter(task => task.status === filters.status);
      }
    }
    
    // Filter by task type
    if (filters.type) {
      result = result.filter(task => 
        task.type === filters.type || 
        (task.taskData && task.taskData.taskType === filters.type)
      );
    }
    
    return result;
  }
}

export { AgentTaskRegistry, Task, TaskData, TaskHistoryEntry, TaskUpdateOptions }; 