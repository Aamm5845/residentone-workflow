interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  assigneeId?: string
  contractorId?: string
  tradeType?: string
  estimatedHours?: number
  actualHours?: number
  estimatedCost?: number
  actualCost?: number
  materials?: any
  dependencies: string[]
  dueDate?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  assignee?: any
  contractor?: any
  createdBy: any
  room?: any
  _count?: any
}

export interface CreateTaskData {
  title: string
  description?: string
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  assigneeId?: string
  contractorId?: string
  tradeType?: string
  estimatedHours?: number
  estimatedCost?: number
  materials?: any
  dependencies?: string[]
  dueDate?: string
  updateId?: string
  roomId?: string
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  assigneeId?: string
  contractorId?: string
  tradeType?: string
  estimatedHours?: number
  actualHours?: number
  estimatedCost?: number
  actualCost?: number
  materials?: any
  dependencies?: string[]
  dueDate?: string
  startedAt?: string
  completedAt?: string
}

export interface TasksResponse {
  tasks: Task[]
  pagination?: any
  stats?: any
}

class TasksAPI {
  private baseUrl = '/api/projects'

  async getTasks(projectId: string, params?: Record<string, string>): Promise<TasksResponse> {
    const url = new URL(`${this.baseUrl}/${projectId}/tasks`, window.location.origin)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch tasks')
    }

    return response.json()
  }

  async createTask(projectId: string, data: CreateTaskData): Promise<{ task: Task }> {
    const response = await fetch(`${this.baseUrl}/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create task')
    }

    return response.json()
  }

  async updateTask(projectId: string, taskId: string, data: UpdateTaskData): Promise<{ task: Task }> {
    const response = await fetch(`${this.baseUrl}/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update task')
    }

    return response.json()
  }

  async deleteTask(projectId: string, taskId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      if (response.status === 409) {
        // Dependency conflict
        throw new Error(`Cannot delete task: ${error.dependentTasks?.join(', ') || 'has dependencies'}`)
      }
      throw new Error(error.message || 'Failed to delete task')
    }

    return response.json()
  }

  async getTask(projectId: string, taskId: string): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/${projectId}/tasks/${taskId}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch task')
    }

    return response.json()
  }
}

export const tasksAPI = new TasksAPI()
export type { Task }