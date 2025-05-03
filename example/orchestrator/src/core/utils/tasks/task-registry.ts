/**
 * Task interfaces for the ASP Orchestrator
 */
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
  status?: string;
  result?: any;
  [key: string]: any;
}

interface Task extends TaskData {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  history: TaskHistoryEntry[];
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
class TaskRegistry {
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
      status: taskData.status || 'pending',
      createdAt: taskData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        status: taskData.status || 'pending',
        timestamp: new Date().toISOString(),
        note: 'Task registered'
      }]
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
      }]
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
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }
    
    // Update the task's assignee
    task.assigneeId = agentId;
    task.status = 'assigned';
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
   * @returns {Task|null} The task object or null if not found
   */
  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Alias for backward compatibility
   * @param {string} taskId - ID of the task to get
   * @returns {Task|null} The task object or null if not found
   */
  getTaskById(taskId: string): Task | null {
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
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }
    
    // Update task with new status and timestamp
    task.status = status;
    task.updatedAt = new Date().toISOString();
    
    // Add task result if provided
    if (options.result !== undefined) {
      task.result = options.result;
    }
    
    // Add task error if provided
    if (options.error !== undefined) {
      task.error = options.error;
    }
    
    // Add task metadata if provided
    if (options.metadata) {
      task.metadata = {
        ...(task.metadata || {}),
        ...options.metadata
      };
    }
    
    // Create history entry
    const historyEntry: TaskHistoryEntry = {
      status,
      timestamp: new Date().toISOString(),
      note: options.note || `Status updated to ${status}`
    };
    
    // Add agent ID to history entry if provided
    if (options.agentId) {
      historyEntry.agentId = options.agentId;
    }
    
    // Add the history entry
    task.history.push(historyEntry);
    
    return task;
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
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }
    
    // Create a history entry with just the note
    const historyEntry: TaskHistoryEntry = {
      status: task.status, // Keep the current status
      timestamp: new Date().toISOString(),
      note
    };
    
    // Add agent ID if provided
    if (agentId) {
      historyEntry.agentId = agentId;
    }
    
    task.history.push(historyEntry);
    task.updatedAt = new Date().toISOString();
    
    return task;
  }

  /**
   * Get the count of tasks based on optional filters
   * @param {Object} filters - Filters to apply to tasks
   * @returns {number} Number of tasks matching the filters
   */
  getTaskCount(filters: Record<string, any> = {}): number {
    return this.getAllTasks(filters).length;
  }
}

export { TaskRegistry, Task, TaskData, TaskHistoryEntry, TaskUpdateOptions }; 