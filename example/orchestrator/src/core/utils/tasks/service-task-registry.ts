import { v4 as uuidv4 } from 'uuid';
import { ServiceTaskRegistry as IServiceTaskRegistry } from '../../../../../types/common';

interface ServiceTask {
  id: string;
  serviceId: string;
  agentId?: string;
  clientId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  taskData: Record<string, any>;
  result: any;
  error: null | { message: string; code?: string; details?: any };
}

interface TaskInfo {
  id?: string;
  serviceId: string;
  agentId?: string;
  clientId?: string;
  taskData?: Record<string, any>;
}

interface TaskStatusData {
  result?: any;
  error?: string | { message: string; code?: string; details?: any };
}

/**
 * ServiceTaskRegistry - Manages tasks assigned to services
 */
export class ServiceTaskRegistry implements IServiceTaskRegistry {
  private tasks: Map<string, ServiceTask>;
  private agentTasks: Map<string, Set<string>>;
  private serviceTasks: Map<string, Set<string>>;
  private clientTasks: Map<string, Set<string>>;

  constructor() {
    this.tasks = new Map();
    this.agentTasks = new Map(); // Map agent ID to task IDs
    this.serviceTasks = new Map(); // Map service ID to task IDs
    this.clientTasks = new Map(); // Map client ID to task IDs
  }

  /**
   * Create a new service task
   * @param {TaskInfo} taskInfo - Task information
   * @returns {ServiceTask} Created task
   */
  createTask(taskInfo: TaskInfo): ServiceTask {
    const taskId = taskInfo.id || uuidv4();
    const now = new Date().toISOString();
    
    const task: ServiceTask = {
      id: taskId,
      serviceId: taskInfo.serviceId,
      agentId: taskInfo.agentId,
      clientId: taskInfo.clientId,
      status: 'pending',
      createdAt: now,
      taskData: taskInfo.taskData || {},
      result: null,
      error: null
    };
    
    // Store the task
    this.tasks.set(taskId, task);
    
    // Add to agent tasks
    if (taskInfo.agentId) {
      const agentTasks = this.agentTasks.get(taskInfo.agentId) || new Set();
      agentTasks.add(taskId);
      this.agentTasks.set(taskInfo.agentId, agentTasks);
    }
    
    // Add to service tasks
    if (taskInfo.serviceId) {
      const serviceTasks = this.serviceTasks.get(taskInfo.serviceId) || new Set();
      serviceTasks.add(taskId);
      this.serviceTasks.set(taskInfo.serviceId, serviceTasks);
    }
    
    // Add to client tasks
    if (taskInfo.clientId) {
      const clientTasks = this.clientTasks.get(taskInfo.clientId) || new Set();
      clientTasks.add(taskId);
      this.clientTasks.set(taskInfo.clientId, clientTasks);
    }
    
    return task;
  }

  /**
   * Get all tasks
   * @returns {Array<ServiceTask>} Array of tasks
   */
  getAllTasks(): ServiceTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task by ID
   * @param {string} taskId - ID of the task to get
   * @returns {ServiceTask|null} Task object or null if not found
   */
  getTask(taskId: string): ServiceTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get task by ID
   * @param {string} taskId - ID of the task to get
   * @returns {ServiceTask|null} Task object or null if not found
   */
  getTaskById(taskId: string): ServiceTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get tasks by service ID
   * @param {string} serviceId - ID of the service
   * @returns {Array<ServiceTask>} Array of tasks
   */
  getTasksByServiceId(serviceId: string): ServiceTask[] {
    const taskIds = this.serviceTasks.get(serviceId) || new Set();
    return Array.from(taskIds)
      .map(taskId => this.tasks.get(taskId))
      .filter((task): task is ServiceTask => task !== undefined);
  }

  /**
   * Get tasks by agent ID
   * @param {string} agentId - ID of the agent
   * @returns {Array<ServiceTask>} Array of tasks
   */
  getTasksByAgentId(agentId: string): ServiceTask[] {
    const taskIds = this.agentTasks.get(agentId) || new Set();
    return Array.from(taskIds)
      .map(taskId => this.tasks.get(taskId))
      .filter((task): task is ServiceTask => task !== undefined);
  }

  /**
   * Get tasks by client ID
   * @param {string} clientId - ID of the client
   * @returns {Array<ServiceTask>} Array of tasks
   */
  getTasksByClientId(clientId: string): ServiceTask[] {
    const taskIds = this.clientTasks.get(clientId) || new Set();
    return Array.from(taskIds)
      .map(taskId => this.tasks.get(taskId))
      .filter((task): task is ServiceTask => task !== undefined);
  }

  /**
   * Get tasks filtered by criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array<ServiceTask>} Array of tasks
   */
  getTasks(filters: { status?: string } = {}): ServiceTask[] {
    let tasks = this.getAllTasks();
    
    // Filter by status if provided
    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status);
    }
    
    return tasks;
  }

  /**
   * Update task status
   * @param {string} taskId - ID of the task to update
   * @param {string} status - New status
   * @param {TaskStatusData} data - Additional data (result or error)
   * @returns {ServiceTask|null} Updated task or null if not found
   */
  updateTaskStatus(
    taskId: string, 
    status: 'pending' | 'in_progress' | 'completed' | 'failed', 
    data: TaskStatusData = {}
  ): ServiceTask | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }
    
    const updatedTask = { ...task, status };
    
    // Add completed timestamp if task is completing
    if (status === 'completed' || status === 'failed') {
      updatedTask.completedAt = new Date().toISOString();
    }
    
    // Add result if provided
    if (data.result !== undefined) {
      updatedTask.result = data.result;
    }
    
    // Add error if provided
    if (data.error) {
      updatedTask.error = typeof data.error === 'string' 
        ? { message: data.error }
        : data.error;
    }
    
    // Update the task
    this.tasks.set(taskId, updatedTask);
    
    return updatedTask;
  }

  /**
   * Remove a task
   * @param {string} taskId - ID of the task to remove
   * @returns {boolean} True if the task was removed, false otherwise
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    
    // Remove from agent tasks
    if (task.agentId && this.agentTasks.has(task.agentId)) {
      const agentTasks = this.agentTasks.get(task.agentId)!;
      agentTasks.delete(taskId);
      
      if (agentTasks.size === 0) {
        this.agentTasks.delete(task.agentId);
      } else {
        this.agentTasks.set(task.agentId, agentTasks);
      }
    }
    
    // Remove from service tasks
    if (task.serviceId && this.serviceTasks.has(task.serviceId)) {
      const serviceTasks = this.serviceTasks.get(task.serviceId)!;
      serviceTasks.delete(taskId);
      
      if (serviceTasks.size === 0) {
        this.serviceTasks.delete(task.serviceId);
      } else {
        this.serviceTasks.set(task.serviceId, serviceTasks);
      }
    }
    
    // Remove from client tasks
    if (task.clientId && this.clientTasks.has(task.clientId)) {
      const clientTasks = this.clientTasks.get(task.clientId)!;
      clientTasks.delete(taskId);
      
      if (clientTasks.size === 0) {
        this.clientTasks.delete(task.clientId);
      } else {
        this.clientTasks.set(task.clientId, clientTasks);
      }
    }
    
    // Remove the task
    this.tasks.delete(taskId);
    
    return true;
  }

  /**
   * Register a task 
   * @param {string} id - ID of the task
   * @param {any} taskData - Task data
   */
  registerTask(id: string, taskData: any): void {
    // Create the task using the provided ID
    this.createTask({
      id,
      serviceId: taskData.serviceId,
      agentId: taskData.agentId,
      clientId: taskData.clientId,
      taskData: taskData
    });
  }
} 