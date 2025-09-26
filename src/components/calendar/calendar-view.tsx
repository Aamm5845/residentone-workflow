'use client'

import { useState, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle, Users, Building, User, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface CalendarTask {
  id: string
  title: string
  project?: string
  projectName?: string
  client?: string
  clientName?: string
  dueDate: string
  status: string
  type: 'stage' | 'approval' | 'task'
  urgencyLevel?: 'critical' | 'high' | 'medium' | 'low'
  assignedUser?: {
    id: string
    name: string
  }
}

interface CalendarViewProps {
  tasks: CalendarTask[]
  isLoading?: boolean
  currentUserId?: string
  currentUserName?: string
}

export default function CalendarView({ 
  tasks, 
  isLoading = false, 
  currentUserId, 
  currentUserName 
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all')

  // Filter tasks to only include those with valid due dates
  const validTasks = tasks.filter(task => task.dueDate && task.dueDate !== null && !isNaN(new Date(task.dueDate).getTime()))

  // Filter tasks based on view mode (all vs user-specific)
  const filteredTasks = useMemo(() => {
    if (viewMode === 'mine' && currentUserId) {
      return validTasks.filter(task => 
        task.assignedUser?.id === currentUserId
      )
    }
    return validTasks
  }, [validTasks, viewMode, currentUserId])

  // Get current month and year
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Get first day of the month and how many days are in the month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: { [date: string]: CalendarTask[] } = {}
    
    filteredTasks.forEach(task => {
      const taskDate = new Date(task.dueDate)
      const dateKey = `${taskDate.getFullYear()}-${taskDate.getMonth()}-${taskDate.getDate()}`
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(task)
    })
    
    return grouped
  }, [filteredTasks])

  // Navigation functions
  const previousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1))
  }

  const today = () => {
    setCurrentDate(new Date())
  }

  // Generate calendar days
  const calendarDays = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getTasksForDate = (day: number | null) => {
    if (!day) return []
    const dateKey = `${currentYear}-${currentMonth}-${day}`
    return tasksByDate[dateKey] || []
  }

  const getTaskColor = (task: CalendarTask) => {
    const dueDate = new Date(task.dueDate)
    const today = new Date()
    const isOverdue = dueDate < today
    const isDueSoon = !isOverdue && (dueDate.getTime() - today.getTime()) <= (3 * 24 * 60 * 60 * 1000) // 3 days
    
    if (isOverdue || task.urgencyLevel === 'critical') return 'bg-red-600'
    if (isDueSoon || task.urgencyLevel === 'high') return 'bg-red-400'
    if (task.urgencyLevel === 'medium') return 'bg-yellow-500'
    if (task.urgencyLevel === 'low') return 'bg-blue-400'
    return 'bg-gray-400'
  }

  const getTaskTextColor = (task: CalendarTask) => {
    const dueDate = new Date(task.dueDate)
    const today = new Date()
    const isOverdue = dueDate < today
    const isDueSoon = !isOverdue && (dueDate.getTime() - today.getTime()) <= (3 * 24 * 60 * 60 * 1000) // 3 days
    
    if (isOverdue) return 'text-red-700'
    if (isDueSoon) return 'text-yellow-700'
    return 'text-gray-700'
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-6 h-6 mr-2" />
            Calendar View
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CardTitle className="flex items-center">
              <Calendar className="w-6 h-6 mr-2" />
              Calendar View
            </CardTitle>
            {currentUserId && (
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${
                    viewMode === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  All Users
                </button>
                <button
                  onClick={() => setViewMode('mine')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${
                    viewMode === 'mine'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <User className="w-4 h-4 mr-1.5" />
                  My Tasks
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={today}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[140px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {filteredTasks.length > 0 && (
          <p className="text-sm text-gray-600">
            Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} with due dates
            {viewMode === 'mine' && currentUserName && (
              <span className="text-purple-600"> for {currentUserName}</span>
            )}
            {viewMode === 'all' && validTasks.length !== filteredTasks.length && (
              <span className="text-gray-500"> (filtered from {validTasks.length} total)</span>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {viewMode === 'mine' ? 'No tasks assigned to you' : 'No scheduled tasks'}
            </h3>
            <p className="text-gray-500">
              {viewMode === 'mine' 
                ? 'You have no tasks with due dates. Switch to "All Users" to see team tasks.' 
                : 'Tasks with due dates will appear on this calendar.'}
            </p>
            {viewMode === 'mine' && validTasks.length > 0 && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setViewMode('all')}
              >
                <Users className="w-4 h-4 mr-2" />
                View All Team Tasks
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Week day headers */}
            {weekDays.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 border-b">
                {day}
              </div>
            ))}
            
            {/* Calendar grid */}
            {calendarDays.map((day, index) => {
              const tasksForDay = getTasksForDate(day)
              const isToday = day && new Date().getDate() === day && 
                            new Date().getMonth() === currentMonth && 
                            new Date().getFullYear() === currentYear
              
              return (
                <div
                  key={index}
                  className={`min-h-[100px] p-1 border border-gray-200 ${
                    day ? 'bg-white' : 'bg-gray-50'
                  } ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {day}
                        {isToday && <span className="ml-1 text-xs text-blue-500">(Today)</span>}
                      </div>
                      <div className="space-y-1">
                        {tasksForDay.slice(0, 3).map((task, taskIndex) => (
                          <Link key={task.id} href={`/stages/${task.id}`}>
                            <div
                              className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getTaskColor(task)} text-white relative`}
                              title={`${task.title} - ${task.projectName || task.project} - Due: ${formatDate(task.dueDate)}${task.assignedUser ? ` - Assigned to: ${task.assignedUser.name}` : ''}`}
                            >
                              <div className="truncate font-medium">
                                {task.title.length > 15 ? `${task.title.substring(0, 15)}...` : task.title}
                              </div>
                              <div className="truncate text-xs opacity-90 flex items-center justify-between">
                                <span>{task.projectName || task.project}</span>
                                {task.assignedUser && viewMode === 'all' && (
                                  <div className="flex items-center ml-1">
                                    <div className="w-3 h-3 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                      <span className="text-[8px] font-bold">
                                        {task.assignedUser.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                        {tasksForDay.length > 3 && (
                          <div className="text-xs text-gray-500 p-1">
                            +{tasksForDay.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}