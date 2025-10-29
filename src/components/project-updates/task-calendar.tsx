'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react'

interface Task {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  dueDate?: string
  assignee?: {
    name: string
  }
}

interface TaskCalendarProps {
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

const statusColors = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800'
}

const priorityColors = {
  URGENT: 'border-red-500',
  HIGH: 'border-orange-500',
  MEDIUM: 'border-yellow-500',
  LOW: 'border-green-500',
  NORMAL: 'border-gray-300'
}

export default function TaskCalendar({ tasks, onTaskClick }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Get tasks with due dates
  const tasksWithDates = tasks.filter(task => task.dueDate)
  
  // Group tasks by date
  const tasksByDate = tasksWithDates.reduce((acc, task) => {
    const date = new Date(task.dueDate!).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  // Get current month info
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString('default', { month: 'long' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }
  
  const goToToday = () => {
    setCurrentDate(new Date())
  }
  
  // Render calendar days
  const renderCalendarDays = () => {
    const days = []
    const today = new Date()
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 p-1 border border-gray-100"></div>
      )
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateStr = date.toDateString()
      const dayTasks = tasksByDate[dateStr] || []
      const isToday = date.toDateString() === today.toDateString()
      const isPast = date < today && !isToday
      
      days.push(
        <div
          key={day}
          className={`h-24 p-1 border border-gray-100 overflow-hidden ${
            isToday ? 'bg-blue-50 border-blue-200' : ''
          } ${isPast ? 'opacity-60' : ''}`}
        >
          <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'} mb-1`}>
            {day}
          </div>
          <div className="space-y-1">
            {dayTasks.slice(0, 2).map(task => (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className={`text-xs p-1 rounded cursor-pointer border-l-2 ${priorityColors[task.priority]} 
                  ${statusColors[task.status]} hover:shadow-sm transition-shadow`}
                title={`${task.title} - ${task.assignee?.name || 'Unassigned'}`}
              >
                <div className="truncate font-medium">{task.title}</div>
                {task.assignee && (
                  <div className="truncate opacity-75">{task.assignee.name}</div>
                )}
              </div>
            ))}
            {dayTasks.length > 2 && (
              <div className="text-xs text-gray-500 px-1">
                +{dayTasks.length - 2} more
              </div>
            )}
          </div>
        </div>
      )
    }
    
    return days
  }
  
  // Upcoming tasks (next 7 days)
  const upcomingTasks = tasksWithDates
    .filter(task => {
      const dueDate = new Date(task.dueDate!)
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      return dueDate <= nextWeek && task.status !== 'DONE'
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)
  
  // Overdue tasks
  const overdueTasks = tasksWithDates.filter(task => {
    const dueDate = new Date(task.dueDate!)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return dueDate < today && task.status !== 'DONE'
  })

  if (tasksWithDates.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No scheduled tasks</h3>
        <p className="text-gray-500">Tasks with due dates will appear on the calendar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-semibold">{monthName} {year}</h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={goToPrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              {/* Days of week header */}
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-0">
                {renderCalendarDays()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center text-red-600">
                  <Clock className="w-4 h-4 mr-2" />
                  Overdue ({overdueTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdueTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="p-2 border border-red-200 rounded cursor-pointer hover:bg-red-50"
                  >
                    <div className="font-medium text-sm truncate">{task.title}</div>
                    <div className="text-xs text-gray-500">
                      Due {new Date(task.dueDate!).toLocaleDateString()}
                    </div>
                    <Badge variant="secondary" className={statusColors[task.status]}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Tasks */}
          {upcomingTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Upcoming</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <div className="font-medium text-sm truncate">{task.title}</div>
                    <div className="text-xs text-gray-500">
                      Due {new Date(task.dueDate!).toLocaleDateString()}
                    </div>
                    {task.assignee && (
                      <div className="text-xs text-gray-600">{task.assignee.name}</div>
                    )}
                    <Badge variant="secondary" className={statusColors[task.status]}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
