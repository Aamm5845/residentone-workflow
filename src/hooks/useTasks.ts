import { useState, useEffect, useCallback } from 'react'
import { tasksAPI, Task, CreateTaskData, UpdateTaskData } from '@/lib/api/tasks'

interface UseTasksResult {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  createTask: (data: CreateTaskData) => Promise<Task>
  updateTask: (taskId: string, data: UpdateTaskData) => Promise<Task>
  deleteTask: (taskId: string) => Promise<void>
  refreshTasks: () => Promise<void>
}

export function useTasks(projectId: string): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshTasks = useCallback(async () => {
    if (!projectId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await tasksAPI.getTasks(projectId)
      setTasks(response.tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const createTask = useCallback(async (data: CreateTaskData): Promise<Task> => {
    if (!projectId) throw new Error('Project ID is required')
    
    try {
      const response = await tasksAPI.createTask(projectId, data)
      const newTask = response.task
      
      // Add to local state
      setTasks(prev => [...prev, newTask])
      
      return newTask
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create task')
    }
  }, [projectId])

  const updateTask = useCallback(async (taskId: string, data: UpdateTaskData): Promise<Task> => {
    if (!projectId) throw new Error('Project ID is required')
    
    try {
      const response = await tasksAPI.updateTask(projectId, taskId, data)
      const updatedTask = response.task
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      
      return updatedTask
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update task')
    }
  }, [projectId])

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    if (!projectId) throw new Error('Project ID is required')
    
    try {
      await tasksAPI.deleteTask(projectId, taskId)
      
      // Remove from local state
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    refreshTasks()
  }, [refreshTasks])

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refreshTasks
  }
}
