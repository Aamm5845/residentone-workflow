'use client'

import { useState, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle, Users, Building, User, Eye, Palette, Shapes, CheckCircle, FileText, Package, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { getHebrewHolidaysForMonth, HebrewHoliday } from '@/lib/hebrew-holidays'
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
  stageType?: string
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
  const [showHolidays, setShowHolidays] = useState(true)

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
  
  // Get Hebrew holidays for the current month
  const hebrewHolidays = useMemo(() => {
    if (!showHolidays) return []
    return getHebrewHolidaysForMonth(currentYear, currentMonth)
  }, [currentYear, currentMonth, showHolidays])

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
  
  const getHolidaysForDate = (day: number | null) => {
    if (!day || !showHolidays) return []
    return hebrewHolidays.filter(holiday => holiday.date.getDate() === day)
  }

  const getPhaseColor = (stageType?: string) => {
    const phaseColors: Record<string, string> = {
      'DESIGN': 'bg-purple-500',
      'DESIGN_CONCEPT': 'bg-purple-500',
      'THREE_D': 'bg-blue-500',
      'CLIENT_APPROVAL': 'bg-green-500',
      'DRAWINGS': 'bg-orange-500',
      'FFE': 'bg-pink-500'
    }
    return phaseColors[stageType || ''] || 'bg-gray-500'
  }

  const getPhaseIcon = (stageType?: string) => {
    const phaseIcons: Record<string, string> = {
      'DESIGN': '🎨',
      'DESIGN_CONCEPT': '🎨',
      'THREE_D': '📊',
      'CLIENT_APPROVAL': '✅',
      'DRAWINGS': '📐',
      'FFE': '🛋️'
    }
    return phaseIcons[stageType || ''] || '📋'
  }

  const getTaskColor = (task: CalendarTask) => {
    const dueDate = new Date(task.dueDate)
    const today = new Date()
    const isOverdue = dueDate < today
    const isDueSoon = !isOverdue && (dueDate.getTime() - today.getTime()) <= (3 * 24 * 60 * 60 * 1000) // 3 days
    
    // Use urgency-based colors for overdue/critical tasks
    if (isOverdue || task.urgencyLevel === 'critical') return 'bg-red-600'
    if (isDueSoon || task.urgencyLevel === 'high') return 'bg-red-400'
    
    // Otherwise use phase-specific colors
    return getPhaseColor(task.stageType)
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
  
  const getHolidayColor = (holiday: HebrewHoliday) => {
    const colorMap = {
      'major': 'bg-gradient-to-r from-purple-500 to-purple-600',
      'minor': 'bg-gradient-to-r from-blue-400 to-blue-500',
      'fast': 'bg-gradient-to-r from-gray-500 to-gray-600',
      'modern': 'bg-gradient-to-r from-teal-400 to-teal-500'
    }
    return colorMap[holiday.type] || 'bg-gradient-to-r from-gray-400 to-gray-500'
  }
  
  const getHolidayIcon = (holiday: HebrewHoliday) => {
    if (holiday.name.includes('Hanukkah')) return '🕎'
    if (holiday.name.includes('Passover')) return '🍷'
    if (holiday.name.includes('Rosh Hashanah')) return '🍎'
    if (holiday.name.includes('Yom Kippur')) return '🙏'
    if (holiday.name.includes('Sukkot')) return '🏕️'
    if (holiday.name.includes('Purim')) return '🎭'
    if (holiday.name.includes('Tu BiShvat')) return '🌳'
    if (holiday.name.includes('Shavot')) return '📜'
    if (holiday.name.includes('Independence')) return '🇮🇱'
    if (holiday.name.includes('Holocaust')) return '🕯️'
    return '✡️'
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
            <div className="flex items-center space-x-4">
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
              <Button
                variant={showHolidays ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHolidays(!showHolidays)}
                className="flex items-center"
              >
                <Star className="w-4 h-4 mr-1.5" />
                {showHolidays ? 'Hide' : 'Show'} Holidays
              </Button>
            </div>
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
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} with due dates
              {viewMode === 'mine' && currentUserName && (
                <span className="text-purple-600"> for {currentUserName}</span>
              )}
              {viewMode === 'all' && validTasks.length !== filteredTasks.length && (
                <span className="text-gray-500"> (filtered from {validTasks.length} total)</span>
              )}
            </p>
            {/* Phase Color Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-gray-600 font-medium">Phases:</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>🎨 Design</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>📊 3D Rendering</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>✅ Client Approval</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>📐 Drawings</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-pink-500 rounded"></div>
                <span>🛋️ FFE</span>
              </div>
              <div className="border-l pl-4 ml-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-600 rounded"></div>
                <span>Overdue/Critical</span>
              </div>
              {showHolidays && (
                <div className="border-l pl-4 ml-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded"></div>
                    <span>✡️ Hebrew Holidays</span>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
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
              const holidaysForDay = getHolidaysForDate(day)
              const isToday = day && new Date().getDate() === day && 
                            new Date().getMonth() === currentMonth && 
                            new Date().getFullYear() === currentYear
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-1 border border-gray-200 ${
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
                        {/* Hebrew Holidays */}
                        {holidaysForDay.map((holiday, holidayIndex) => (
                          <div
                            key={holiday.id}
                            className={`text-xs p-1 rounded text-white ${getHolidayColor(holiday)} border border-white/20`}
                            title={`${holiday.name} (${holiday.hebrewName}) - ${holiday.description}`}
                          >
                            <div className="truncate font-medium flex items-center space-x-1">
                              <span className="text-xs">{getHolidayIcon(holiday)}</span>
                              <span>{holiday.name.length > 10 ? `${holiday.name.substring(0, 10)}...` : holiday.name}</span>
                            </div>
                          </div>
                        ))}
                        
                        {/* Tasks */}
                        {tasksForDay.slice(0, showHolidays ? 2 : 3).map((task, taskIndex) => (
                          <Link key={task.id} href={`/stages/${task.id}`}>
                            <div
                              className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getTaskColor(task)} text-white relative`}
                              title={`${task.title} - ${task.projectName || task.project} - Due: ${formatDate(task.dueDate)}${task.assignedUser ? ` - Assigned to: ${task.assignedUser.name}` : ''}`}
                            >
                              <div className="truncate font-medium flex items-center space-x-1">
                                <span className="text-xs">{getPhaseIcon(task.stageType)}</span>
                                <span>{task.title.length > 12 ? `${task.title.substring(0, 12)}...` : task.title}</span>
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
                        
                        {/* Show more indicator */}
                        {(tasksForDay.length > (showHolidays ? 2 : 3) || (showHolidays && holidaysForDay.length > 0 && tasksForDay.length > 2)) && (
                          <div className="text-xs text-gray-500 p-1">
                            +{tasksForDay.length - (showHolidays ? 2 : 3)} more
                            {holidaysForDay.length > 1 && showHolidays && (
                              <span>, {holidaysForDay.length - 1} more holiday{holidaysForDay.length > 2 ? 's' : ''}</span>
                            )}
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
