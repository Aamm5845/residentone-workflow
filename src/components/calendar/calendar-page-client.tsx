'use client'

import { useState, useMemo } from 'react'
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  User, 
  Palette, 
  Box, 
  CheckCircle, 
  FileText, 
  Package, 
  Star,
  CalendarDays,
  Filter,
  Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { getHebrewHolidaysForMonth, HebrewHoliday } from '@/lib/hebrew-holidays'
import Link from 'next/link'

interface CalendarTask {
  id: string
  title: string
  projectName?: string
  clientName?: string
  dueDate: string
  status: string
  type: 'stage' | 'approval' | 'task'
  stageType?: string
  assignedUser?: {
    id: string
    name: string
  }
}

interface Project {
  id: string
  name: string
  client: { name: string }
  rooms?: {
    id: string
    type: string
    name?: string
    startDate?: Date
    dueDate?: Date
    stages?: {
      id: string
      type: string
      status: string
      startDate?: Date
      dueDate?: Date
      assignedUser?: {
        id: string
        name: string
      }
    }[]
  }[]
}

interface CalendarPageClientProps {
  projects: Project[]
  currentUser: {
    id: string
    name: string
    email: string
  }
}

export default function CalendarPageClient({ 
  projects, 
  currentUser 
}: CalendarPageClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all')
  const [showHolidays, setShowHolidays] = useState(true)
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE'])

  // Transform projects into calendar tasks
  const allTasks = useMemo(() => {
    const tasks: CalendarTask[] = []
    
    projects.forEach(project => {
      project.rooms?.forEach(room => {
        room.stages?.forEach(stage => {
          const phaseTitle = stage.type === 'THREE_D' ? '3D Rendering' : 
                            stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
          
          // Add start date entry if exists
          if (stage.startDate && stage.status !== 'COMPLETED') {
            tasks.push({
              id: `${stage.id}-start`,
              title: `${phaseTitle} Start - ${room.name || room.type.replace('_', ' ')}`,
              projectName: project.name,
              clientName: project.client.name,
              dueDate: new Date(stage.startDate).toISOString(),
              status: stage.status,
              type: 'stage' as const,
              stageType: stage.type,
              assignedUser: stage.assignedUser ? {
                id: stage.assignedUser.id,
                name: stage.assignedUser.name || 'Unknown'
              } : undefined
            })
          }
          
          // Add due date entry if exists
          if (stage.dueDate && stage.status !== 'COMPLETED') {
            tasks.push({
              id: stage.id,
              title: `${phaseTitle} - ${room.name || room.type.replace('_', ' ')}`,
              projectName: project.name,
              clientName: project.client.name,
              dueDate: new Date(stage.dueDate).toISOString(),
              status: stage.status,
              type: 'stage' as const,
              stageType: stage.type,
              assignedUser: stage.assignedUser ? {
                id: stage.assignedUser.id,
                name: stage.assignedUser.name || 'Unknown'
              } : undefined
            })
          }
        })
        
        // Add room-level dates
        if (room.startDate) {
          tasks.push({
            id: `${room.id}-room-start`,
            title: `Room Start: ${room.name || room.type.replace('_', ' ')}`,
            projectName: project.name,
            clientName: project.client.name,
            dueDate: new Date(room.startDate).toISOString(),
            status: 'PENDING',
            type: 'stage' as const,
            stageType: 'ROOM_START'
          })
        }
        if (room.dueDate) {
          tasks.push({
            id: `${room.id}-room-due`,
            title: `Room Due: ${room.name || room.type.replace('_', ' ')}`,
            projectName: project.name,
            clientName: project.client.name,
            dueDate: new Date(room.dueDate).toISOString(),
            status: 'PENDING',
            type: 'stage' as const,
            stageType: 'ROOM_DUE'
          })
        }
      })
    })
    
    return tasks
  }, [projects])

  // Filter tasks based on view mode and selected phases
  const filteredTasks = useMemo(() => {
    let tasks = allTasks
    
    if (viewMode === 'mine') {
      tasks = tasks.filter(task => task.assignedUser?.id === currentUser.id)
    }
    
    // Filter by selected phases
    tasks = tasks.filter(task => {
      if (task.stageType === 'ROOM_START' || task.stageType === 'ROOM_DUE') return true
      return selectedPhases.includes(task.stageType || '')
    })
    
    return tasks
  }, [allTasks, viewMode, currentUser.id, selectedPhases])

  // Get current month and year
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()
  
  // Get Hebrew holidays for the current month
  const hebrewHolidays = useMemo(() => {
    if (!showHolidays) return []
    return getHebrewHolidaysForMonth(currentYear, currentMonth)
  }, [currentYear, currentMonth, showHolidays])

  // Get first day of the month and how many days are in the month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

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
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
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
  
  const getHolidaysForDate = (day: number | null) => {
    if (!day || !showHolidays) return []
    return hebrewHolidays.filter(holiday => holiday.date.getDate() === day)
  }

  // Phase colors matching the brand
  const phaseConfig: Record<string, { color: string, bgColor: string, icon: any, label: string }> = {
    'DESIGN_CONCEPT': { color: 'bg-purple-500', bgColor: 'bg-purple-50', icon: Palette, label: 'Design' },
    'THREE_D': { color: 'bg-blue-500', bgColor: 'bg-blue-50', icon: Box, label: '3D Rendering' },
    'CLIENT_APPROVAL': { color: 'bg-green-500', bgColor: 'bg-green-50', icon: CheckCircle, label: 'Approval' },
    'DRAWINGS': { color: 'bg-orange-500', bgColor: 'bg-orange-50', icon: FileText, label: 'Drawings' },
    'FFE': { color: 'bg-pink-500', bgColor: 'bg-pink-50', icon: Package, label: 'FFE' },
    'ROOM_START': { color: 'bg-teal-400', bgColor: 'bg-teal-50', icon: Calendar, label: 'Room Start' },
    'ROOM_DUE': { color: 'bg-indigo-500', bgColor: 'bg-indigo-50', icon: Calendar, label: 'Room Due' }
  }

  const getTaskColor = (task: CalendarTask) => {
    // Always use consistent phase colors - no urgency overrides
    const config = phaseConfig[task.stageType || '']
    return config?.color || 'bg-gray-500'
  }

  const getPhaseIcon = (stageType?: string) => {
    const config = phaseConfig[stageType || '']
    return config?.icon || Calendar
  }

  const togglePhase = (phase: string) => {
    setSelectedPhases(prev => 
      prev.includes(phase) 
        ? prev.filter(p => p !== phase)
        : [...prev, phase]
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600 mt-1">View and manage all your project deadlines</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: View Toggle & Filters */}
          <div className="flex items-center space-x-3">
            {/* User Filter */}
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
                All Tasks
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

            {/* Holiday Toggle */}
            <Button
              variant={showHolidays ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHolidays(!showHolidays)}
              className={showHolidays ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              <Star className="w-4 h-4 mr-1.5" />
              Holidays
            </Button>
          </div>

          {/* Right: Month Navigation */}
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={today}>
              Today
            </Button>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={previousMonth} className="rounded-md h-8 w-8 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[140px] text-center px-2">
                {monthNames[currentMonth]} {currentYear}
              </span>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="rounded-md h-8 w-8 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Phase Filters */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center flex-wrap gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 mr-1">Filter:</span>
            {Object.entries(phaseConfig).filter(([key]) => !['ROOM_START', 'ROOM_DUE'].includes(key)).map(([key, config]) => {
              const Icon = config.icon
              const isSelected = selectedPhases.includes(key)
              return (
                <button
                  key={key}
                  onClick={() => togglePhase(key)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isSelected 
                      ? `${config.color} text-white shadow-sm` 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-gray-50">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center text-xs font-semibold text-gray-600 border-b border-gray-200">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const tasksForDay = getTasksForDate(day)
            const holidaysForDay = getHolidaysForDate(day)
            const isToday = day && new Date().getDate() === day && 
                          new Date().getMonth() === currentMonth && 
                          new Date().getFullYear() === currentYear
            const isWeekend = index % 7 === 0 || index % 7 === 6
            
            return (
              <div
                key={index}
                className={`min-h-[120px] p-1.5 border-b border-r border-gray-100 transition-colors ${
                  day ? (isWeekend ? 'bg-gray-50/50' : 'bg-white') : 'bg-gray-50'
                } ${isToday ? 'bg-cyan-50 ring-1 ring-cyan-400 ring-inset' : ''} hover:bg-gray-50`}
              >
                {day && (
                  <>
                    <div className={`text-xs font-medium mb-1 flex items-center justify-between ${
                      isToday ? 'text-cyan-600' : 'text-gray-700'
                    }`}>
                      <span className={`${isToday ? 'bg-cyan-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs' : ''}`}>
                        {day}
                      </span>
                      {isToday && <span className="text-[10px] text-cyan-500 font-medium">Today</span>}
                    </div>
                    <div className="space-y-0.5">
                      {/* Hebrew Holidays */}
                      {holidaysForDay.map((holiday) => (
                        <div
                          key={holiday.id}
                          className="text-[10px] p-1 rounded text-white bg-gradient-to-r from-purple-500 to-purple-600"
                          title={`${holiday.name} (${holiday.hebrewName}) - ${holiday.description}`}
                        >
                          <div className="truncate font-medium flex items-center space-x-0.5">
                            <span>✡️</span>
                            <span>{holiday.name.length > 10 ? `${holiday.name.substring(0, 10)}...` : holiday.name}</span>
                          </div>
                        </div>
                      ))}
                      
                      {/* Tasks */}
                      {tasksForDay.slice(0, showHolidays && holidaysForDay.length > 0 ? 2 : 3).map((task) => {
                        // Build the correct link
                        let taskLink = `/stages/${task.id}`
                        if (task.id.includes('-room-start') || task.id.includes('-room-due')) {
                          taskLink = '#'
                        } else if (task.id.includes('-start')) {
                          const stageId = task.id.replace('-start', '')
                          taskLink = `/stages/${stageId}`
                        }
                        
                        const PhaseIcon = getPhaseIcon(task.stageType)
                        
                        return (
                          <Link key={task.id} href={taskLink}>
                            <div
                              className={`text-[10px] p-1 rounded cursor-pointer hover:opacity-90 transition-all ${getTaskColor(task)} text-white`}
                              title={`${task.title} - ${task.projectName} - Due: ${formatDate(task.dueDate)}${task.assignedUser ? ` - Assigned to: ${task.assignedUser.name}` : ''}`}
                            >
                              <div className="truncate font-medium flex items-center space-x-0.5">
                                <PhaseIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                <span>{task.title.length > 12 ? `${task.title.substring(0, 12)}...` : task.title}</span>
                              </div>
                              <div className="truncate text-[9px] opacity-90">
                                {task.projectName}
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                      
                      {/* Show more indicator */}
                      {tasksForDay.length > (showHolidays && holidaysForDay.length > 0 ? 2 : 3) && (
                        <div className="text-[10px] text-gray-500 p-0.5 flex items-center">
                          <Eye className="w-2.5 h-2.5 mr-0.5" />
                          +{tasksForDay.length - (showHolidays && holidaysForDay.length > 0 ? 2 : 3)} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center mt-4">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">
            {viewMode === 'mine' ? 'No tasks assigned to you' : 'No scheduled tasks'}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {viewMode === 'mine' 
              ? 'Switch to "All Tasks" to see team tasks.' 
              : 'Add due dates to your project stages to see them here.'}
          </p>
          {viewMode === 'mine' && allTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setViewMode('all')}
            >
              <Users className="w-4 h-4 mr-1.5" />
              View All Tasks
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
