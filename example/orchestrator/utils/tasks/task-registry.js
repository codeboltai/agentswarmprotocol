/**
 * Task Registry for the ASP Orchestrator
 * Manages active and completed tasks in the system
 */
class TaskRegistry {
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
  _generateTaskId() {
    return `task_${Date.now()}_${this.taskIdCounter++}`;
  }

  /**
   * Check if a task exists
   * @param {string} taskId - ID of the task to check
   * @returns {boolean} True if the task exists, false otherwise
   */
  hasTask(taskId) {
    return this.tasks.has(taskId);
  }

  /**
   * Register a task directly with given task ID (primarily for client tasks)
   * @param {string} taskId - ID of the task
   * @param {Object} taskData - Task details
   * @returns {Object} The registered task
   */
  registerTask(taskId, taskData) {
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    const task = {
      id: taskId,
      ...taskData,
      updatedAt: new Date().toISOString(),
      history: [{
        status: taskData.status || 'pending',
        timestamp: new Date().toISOString(),
        note: 'Task registered'
      }]
    };
    
    this.tasks.set(taskId, task);
    
    // Track task by agent ID if present
    if (taskData.agentId) {
      this._assignTaskToAgent(taskId, taskData.agentId);
    }
    
    // Track task by client ID if present
    if (taskData.clientId) {
      this._assignTaskToClient(taskId, taskData.clientId);
    }
    
    return task;
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task details
   * @param {string} taskData.type - Type of task
   * @param {string} taskData.name - Name of the task
   * @param {string} taskData.description - Description of the task
   * @param {Object} taskData.input - Input data for the task
   * @param {string} taskData.requesterId - ID of the agent requesting the task
   * @param {string} [taskData.assigneeId] - ID of the agent assigned to the task
   * @param {string} [taskData.clientId] - ID of the client that created the task
   * @returns {Object} The created task
   */
  createTask(taskData) {
    if (!taskData.type) {
      throw new Error('Task type is required');
    }
    
    if (!taskData.name) {
      throw new Error('Task name is required');
    }
    
    const taskId = taskData.id || this._generateTaskId();
    
    const task = {
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
   * @returns {Object|null} The updated task or null if task not found
   */
  assignTask(taskId, agentId) {
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
  _assignTaskToAgent(taskId, agentId) {
    if (!this.tasksByAgentId.has(agentId)) {
      this.tasksByAgentId.set(agentId, []);
    }
    
    const agentTasks = this.tasksByAgentId.get(agentId);
    if (!agentTasks.includes(taskId)) {
      agentTasks.push(taskId);
    }
  }

  /**
   * Internal method to track task creation by client
   * @private
   * @param {string} taskId - ID of the task
   * @param {string} clientId - ID of the client
   */
  _assignTaskToClient(taskId, clientId) {
    if (!this.tasksByClientId.has(clientId)) {
      this.tasksByClientId.set(clientId, []);
    }
    
    const clientTasks = this.tasksByClientId.get(clientId);
    if (!clientTasks.includes(taskId)) {
      clientTasks.push(taskId);
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId - ID of the task to get
   * @returns {Object|null} The task object or null if not found
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  // Alias for backward compatibility
  getTaskById(taskId) {
    return this.getTask(taskId);
  }

  /**
   * Update task status
   * @param {string} taskId - ID of the task to update
   * @param {string} status - New status for the task
   * @param {Object|string} options - Additional update options or result data
   * @param {string} [options.note] - Optional note about the status change
   * @param {Object} [options.result] - Optional task result data
   * @returns {Object|null} The updated task or null if task not found
   */
  updateTaskStatus(taskId, status, options = {}) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }
    
    task.status = status;
    task.updatedAt = new Date().toISOString();
    
    // Handle case where options is the result data directly
    let resultData = options;
    let note = `Status changed to ${status}`;
    
    if (typeof options === 'object') {
      resultData = options.result || options;
      note = options.note || note;
    }
    
    // Add status update to history
    task.history.push({
      status,
      timestamp: new Date().toISOString(),
      note
    });
    
    // Add result data
    task.result = resultData;
    
    // If status indicates completion, add completedAt timestamp
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date().toISOString();
    }
    
    return task;
  }

  /**
   * Get all tasks for a specific agent
   * @param {string} agentId - ID of the agent
   * @returns {Array<Object>} Array of tasks assigned to the agent
   */
  getTasksByAgentId(agentId) {
    const taskIds = this.tasksByAgentId.get(agentId) || [];
    return taskIds.map(taskId => this.getTask(taskId)).filter(Boolean);
  }

  /**
   * Get all tasks for a specific client
   * @param {string} clientId - ID of the client
   * @returns {Array<Object>} Array of tasks created by the client
   */
  getTasksByClientId(clientId) {
    const taskIds = this.tasksByClientId.get(clientId) || [];
    return taskIds.map(taskId => this.getTask(taskId)).filter(Boolean);
  }

  /**
   * Get all tasks
   * @param {Object} filters - Optional filters to apply
   * @param {string} filters.status - Filter by task status
   * @param {string} filters.type - Filter by task type
   * @param {string} filters.requesterId - Filter by requester agent ID
   * @param {string} filters.clientId - Filter by client ID
   * @returns {Array<Object>} Array of matching tasks
   */
  getAllTasks(filters = {}) {
    let tasks = Array.from(this.tasks.values());
    
    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status);
    }
    
    if (filters.type) {
      tasks = tasks.filter(task => task.type === filters.type);
    }
    
    if (filters.requesterId) {
      tasks = tasks.filter(task => task.requesterId === filters.requesterId);
    }
    
    if (filters.clientId) {
      tasks = tasks.filter(task => task.clientId === filters.clientId);
    }
    
    return tasks;
  }

  /**
   * Get active tasks (not completed or failed)
   * @returns {Array<Object>} Array of active tasks
   */
  getActiveTasks() {
    return this.getAllTasks().filter(task => 
      !['completed', 'failed', 'cancelled'].includes(task.status)
    );
  }

  /**
   * Get completed tasks
   * @returns {Array<Object>} Array of completed tasks
   */
  getCompletedTasks() {
    return this.getAllTasks({ status: 'completed' });
  }

  /**
   * Remove a task
   * @param {string} taskId - ID of the task to remove
   * @returns {boolean} True if the task was removed, false otherwise
   */
  removeTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) {
      return false;
    }
    
    this.tasks.delete(taskId);
    
    // Remove from agent's task list if assigned
    if (task.assigneeId && this.tasksByAgentId.has(task.assigneeId)) {
      const agentTasks = this.tasksByAgentId.get(task.assigneeId);
      const index = agentTasks.indexOf(taskId);
      if (index !== -1) {
        agentTasks.splice(index, 1);
      }
      
      // Clean up empty agent task lists
      if (agentTasks.length === 0) {
        this.tasksByAgentId.delete(task.assigneeId);
      }
    }
    
    // Remove from client's task list if assigned
    if (task.clientId && this.tasksByClientId.has(task.clientId)) {
      const clientTasks = this.tasksByClientId.get(task.clientId);
      const index = clientTasks.indexOf(taskId);
      if (index !== -1) {
        clientTasks.splice(index, 1);
      }
      
      // Clean up empty client task lists
      if (clientTasks.length === 0) {
        this.tasksByClientId.delete(task.clientId);
      }
    }
    
    return true;
  }

  /**
   * Add a note to a task
   * @param {string} taskId - ID of the task
   * @param {string} note - Note to add
   * @param {string} [agentId] - ID of the agent adding the note
   * @returns {Object|null} The updated task or null if task not found
   */
  addTaskNote(taskId, note, agentId = null) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }
    
    task.history.push({
      timestamp: new Date().toISOString(),
      note,
      agentId
    });
    
    task.updatedAt = new Date().toISOString();
    
    return task;
  }

  /**
   * Get task count
   * @param {Object} filters - Optional filters to apply
   * @returns {number} Count of matching tasks
   */
  getTaskCount(filters = {}) {
    return this.getAllTasks(filters).length;
  }
}

module.exports = { TaskRegistry }; 