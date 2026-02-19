'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
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
  CheckSquare,
  FileText,
  Package,
  Star,
  CalendarDays,
  CalendarPlus,
  Eye,
  Umbrella,
  Video,
  MapPin,
  X,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { getHebrewHolidaysForMonth, HebrewHoliday } from '@/lib/hebrew-holidays'
import { getCanadianHolidaysForMonth, CanadianHoliday } from '@/lib/canadian-holidays'
import { ScheduleMeetingDialog } from './schedule-meeting-dialog'
import { MeetingDetailDialog } from './meeting-detail-dialog'
import { AddOffDayDialog } from './add-off-day-dialog'

type Holiday = (HebrewHoliday | CanadianHoliday) & { source: 'hebrew' | 'canadian' }
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

interface TaskItem {
  id: string
  title: string
  status: string
  priority: string
  startDate: string | null
  dueDate: string | null
  project: { id: string; name: string }
  assignedTo?: { id: string; name: string; email: string } | null
}

interface TeamOffDay {
  id: string
  userId: string
  userName: string
  date: string
  reason: string
  notes?: string | null
}

interface MeetingItem {
  id: string
  title: string
  description?: string | null
  date: string
  startTime: string
  endTime: string
  locationType: string
  locationDetails?: string | null
  meetingLink?: string | null
  status: string
  reminderMinutes: number
  projectId?: string | null
  project?: { id: string; name: string } | null
  organizer?: { id: string; name: string | null; email: string } | null
  attendees: Array<{
    id: string
    type: string
    status: string
    userId?: string | null
    clientId?: string | null
    contractorId?: string | null
    externalName?: string | null
    externalEmail?: string | null
    user?: { id: string; name: string | null; email: string } | null
    client?: { id: string; name: string; email: string } | null
    contractor?: { id: string; businessName: string; contactName: string | null; email: string; type: string } | null
  }>
}

interface CalendarPageClientProps {
  projects: Project[]
  tasks?: TaskItem[]
  teamOffDays?: TeamOffDay[]
  meetings?: MeetingItem[]
  projectList?: { id: string; name: string }[]
  currentUser: {
    id: string
    name: string
    email: string
    role?: string
  }
}

export default function CalendarPageClient({
  projects,
  tasks: taskItems = [],
  teamOffDays = [],
  meetings: meetingItems = [],
  projectList = [],
  currentUser
}: CalendarPageClientProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all')
  const [showHolidays, setShowHolidays] = useState(true)
  const [showVacations, setShowVacations] = useState(true)
  const [showMeetings, setShowMeetings] = useState(true)
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE', 'TASK'])

  // Meeting dialogs state
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(null)
  const [meetingDetailOpen, setMeetingDetailOpen] = useState(false)
  const [editMeeting, setEditMeeting] = useState<MeetingItem | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Day click state
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [scheduleMeetingDate, setScheduleMeetingDate] = useState<string | null>(null)
  const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false)
  const [addOffDayDate, setAddOffDayDate] = useState<string | null>(null)
  const [addOffDayOpen, setAddOffDayOpen] = useState(false)

  // Stable reference for "today" to avoid hydration issues
  const [todayRef] = useState(() => {
    const now = new Date()
    return { date: now.getDate(), month: now.getMonth(), year: now.getFullYear() }
  })

  const handleMeetingClick = (meeting: MeetingItem) => {
    setSelectedMeeting(meeting)
    setMeetingDetailOpen(true)
  }

  const handleDayClick = (day: number) => {
    setSelectedDay(prev => prev === day ? null : day)
  }

  const handleScheduleForDay = (day: number) => {
    // Format as YYYY-MM-DD for the date input
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setScheduleMeetingDate(dateStr)
    setScheduleMeetingOpen(true)
  }

  const handleAddOffDayForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setAddOffDayDate(dateStr)
    setAddOffDayOpen(true)
  }

  const handleEditMeeting = (meeting: any) => {
    setEditMeeting(meeting)
  }

  const handleMeetingSuccess = useCallback(() => {
    setRefreshKey(k => k + 1)
    setEditMeeting(null)
    // Reload the page to get fresh data
    window.location.reload()
  }, [])

  // Transform projects into calendar tasks
  // Only show items with a due date on the calendar (no start dates)
  const allTasks = useMemo(() => {
    const tasks: CalendarTask[] = []

    projects.forEach(project => {
      project.rooms?.forEach(room => {
        room.stages?.forEach(stage => {
          const phaseTitle = stage.type === 'THREE_D' ? '3D Rendering' :
                            stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())

          // Only show stages with a due date
          if (stage.dueDate && stage.status !== 'COMPLETED') {
            tasks.push({
              id: stage.id,
              title: `${phaseTitle} Due — ${room.name || room.type.replace('_', ' ')}`,
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

        // Only show room due dates (not start dates)
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

    // Only show user tasks with a due date
    taskItems.forEach(task => {
      if (task.dueDate) {
        tasks.push({
          id: `task-${task.id}-due`,
          title: task.title,
          projectName: task.project.name,
          dueDate: task.dueDate,
          status: task.status,
          type: 'task' as const,
          stageType: 'TASK',
          assignedUser: task.assignedTo ? {
            id: task.assignedTo.id,
            name: task.assignedTo.name || 'Unknown'
          } : undefined
        })
      }
    })

    return tasks
  }, [projects, taskItems])

  // Filter tasks based on view mode and selected phases
  const filteredTasks = useMemo(() => {
    let tasks = allTasks

    if (viewMode === 'mine') {
      tasks = tasks.filter(task => task.assignedUser?.id === currentUser.id)
    }

    // Filter by selected phases
    tasks = tasks.filter(task => {
      if (task.stageType === 'ROOM_DUE') return true
      return selectedPhases.includes(task.stageType || '')
    })

    return tasks
  }, [allTasks, viewMode, currentUser.id, selectedPhases])

  // Filter meetings: only show meetings where the current user is an attendee
  const userMeetings = useMemo(() => {
    return meetingItems.filter(meeting =>
      meeting.attendees.some(att => att.userId === currentUser.id)
    )
  }, [meetingItems, currentUser.id])

  // Group meetings by date
  const meetingsByDate = useMemo(() => {
    if (!showMeetings) return {}
    const grouped: { [date: string]: MeetingItem[] } = {}

    userMeetings.forEach(meeting => {
      const d = new Date(meeting.date)
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(meeting)
    })

    return grouped
  }, [userMeetings, showMeetings])

  // Get current month and year
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Get all holidays for the current month (Hebrew + Canadian)
  const allHolidays = useMemo((): Holiday[] => {
    if (!showHolidays) return []
    const hebrew = getHebrewHolidaysForMonth(currentYear, currentMonth).map(h => ({ ...h, source: 'hebrew' as const }))
    const canadian = getCanadianHolidaysForMonth(currentYear, currentMonth).map(h => ({ ...h, source: 'canadian' as const }))
    return [...hebrew, ...canadian].sort((a, b) => a.date.getTime() - b.date.getTime())
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

  // Group team off days by date
  const offDaysByDate = useMemo(() => {
    if (!showVacations) return {}
    const grouped: { [date: string]: TeamOffDay[] } = {}

    teamOffDays.forEach(od => {
      const d = new Date(od.date)
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(od)
    })

    return grouped
  }, [teamOffDays, showVacations])

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
    return allHolidays.filter(holiday => holiday.date.getDate() === day)
  }

  const getOffDaysForDate = (day: number | null) => {
    if (!day || !showVacations) return []
    const dateKey = `${currentYear}-${currentMonth}-${day}`
    return offDaysByDate[dateKey] || []
  }

  const getMeetingsForDate = (day: number | null) => {
    if (!day || !showMeetings) return []
    const dateKey = `${currentYear}-${currentMonth}-${day}`
    return meetingsByDate[dateKey] || []
  }

  const formatMeetingTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const getOffDayLabel = (reason: string) => {
    const labels: Record<string, string> = {
      VACATION: 'Vacation',
      SICK: 'Sick',
      PERSONAL: 'Personal',
      HOLIDAY: 'Holiday',
      OTHER: 'Off',
    }
    return labels[reason] || 'Off'
  }

  const getHolidayColor = (holiday: Holiday) => {
    if (holiday.source === 'canadian') {
      return 'bg-red-50 text-red-700 border border-red-200'
    }
    const hebrewHoliday = holiday as HebrewHoliday & { source: string }
    const colorMap: Record<string, string> = {
      'major': 'bg-purple-50 text-purple-700 border border-purple-200',
      'minor': 'bg-blue-50 text-blue-700 border border-blue-200',
      'fast': 'bg-gray-100 text-gray-600 border border-gray-200',
      'modern': 'bg-teal-50 text-teal-700 border border-teal-200'
    }
    return colorMap[hebrewHoliday.type] || 'bg-gray-50 text-gray-600 border border-gray-200'
  }

  const getHolidayIcon = (holiday: Holiday) => {
    if (holiday.source === 'canadian') {
      if (holiday.name.includes('Canada Day')) return '\u{1F1E8}\u{1F1E6}'
      if (holiday.name.includes('Victoria Day')) return '\u{1F451}'
      if (holiday.name.includes('Thanksgiving')) return '\u{1F983}'
      if (holiday.name.includes('Christmas')) return '\u{1F384}'
      if (holiday.name.includes('Boxing')) return '\u{1F381}'
      if (holiday.name.includes('New Year')) return '\u{1F386}'
      if (holiday.name.includes('Good Friday') || holiday.name.includes('Easter')) return '\u{271D}\u{FE0F}'
      if (holiday.name.includes('Labour')) return '\u{1F477}'
      if (holiday.name.includes('Remembrance')) return '\u{1F33A}'
      if (holiday.name.includes('Family')) return '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}'
      if (holiday.name.includes('Truth')) return '\u{1F9E1}'
      if (holiday.name.includes('Civic')) return '\u{1F3DB}\u{FE0F}'
      return '\u{1F341}'
    }
    if (holiday.name.includes('Hanukkah')) return '\u{1F54E}'
    if (holiday.name.includes('Passover')) return '\u{1F377}'
    if (holiday.name.includes('Rosh Hashanah')) return '\u{1F34E}'
    if (holiday.name.includes('Yom Kippur')) return '\u{1F64F}'
    if (holiday.name.includes('Sukkot')) return '\u{1F3D5}\u{FE0F}'
    if (holiday.name.includes('Purim')) return '\u{1F3AD}'
    if (holiday.name.includes('Tu BiShvat')) return '\u{1F333}'
    if (holiday.name.includes('Shavot')) return '\u{1F4DC}'
    if (holiday.name.includes('Independence')) return '\u{1F1EE}\u{1F1F1}'
    if (holiday.name.includes('Holocaust')) return '\u{1F56F}\u{FE0F}'
    return '\u{2721}\u{FE0F}'
  }

  // Phase colors — soft, muted palette
  const phaseConfig: Record<string, { color: string, bgColor: string, icon: any, label: string }> = {
    'DESIGN_CONCEPT': { color: 'bg-slate-400', bgColor: 'bg-slate-50', icon: Palette, label: 'Design' },
    'THREE_D': { color: 'bg-slate-400', bgColor: 'bg-slate-50', icon: Box, label: '3D Rendering' },
    'CLIENT_APPROVAL': { color: 'bg-slate-400', bgColor: 'bg-slate-50', icon: CheckCircle, label: 'Approval' },
    'DRAWINGS': { color: 'bg-slate-400', bgColor: 'bg-slate-50', icon: FileText, label: 'Drawings' },
    'FFE': { color: 'bg-slate-400', bgColor: 'bg-slate-50', icon: Package, label: 'FFE' },
    'ROOM_DUE': { color: 'bg-slate-300', bgColor: 'bg-slate-50', icon: Calendar, label: 'Room Due' },
    'TASK': { color: 'bg-slate-500', bgColor: 'bg-slate-50', icon: CheckSquare, label: 'Tasks' }
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-1">View and manage all your project deadlines and meetings</p>
        </div>
        <ScheduleMeetingDialog
          projects={projectList}
          editMeeting={editMeeting}
          onSuccess={handleMeetingSuccess}
        />
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

            {/* Meetings Toggle */}
            <Button
              variant={showMeetings ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMeetings(!showMeetings)}
              className={showMeetings ? "bg-gray-700 hover:bg-gray-800" : ""}
            >
              <Video className="w-4 h-4 mr-1.5" />
              Meetings
            </Button>

            {/* Holiday Toggle */}
            <Button
              variant={showHolidays ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHolidays(!showHolidays)}
              className={showHolidays ? "bg-gray-500 hover:bg-gray-600" : ""}
            >
              <Star className="w-4 h-4 mr-1.5" />
              Holidays
            </Button>

            {/* Vacations Toggle */}
            <Button
              variant={showVacations ? "default" : "outline"}
              size="sm"
              onClick={() => setShowVacations(!showVacations)}
              className={showVacations ? "bg-gray-500 hover:bg-gray-600" : ""}
            >
              <Umbrella className="w-4 h-4 mr-1.5" />
              Vacations
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
            const offDaysForDay = getOffDaysForDate(day)
            const meetingsForDay = getMeetingsForDate(day)
            const isToday = day && todayRef.date === day &&
                          todayRef.month === currentMonth &&
                          todayRef.year === currentYear
            const isWeekend = index % 7 === 0 || index % 7 === 6

            // Calculate how many slots are taken by holidays, off days, and meetings
            const fixedSlots = holidaysForDay.length + (offDaysForDay.length > 0 ? 1 : 0) + meetingsForDay.length
            const maxTaskSlots = Math.max(0, 3 - fixedSlots)

            const isSelected = day !== null && selectedDay === day

            return (
              <div
                key={index}
                onClick={() => day && handleDayClick(day)}
                className={`min-h-[120px] p-1.5 border-b border-r border-gray-100 transition-colors ${
                  day ? (isWeekend ? 'bg-gray-50/50' : 'bg-white') : 'bg-gray-50'
                } ${isToday ? 'bg-blue-50/50 ring-1 ring-blue-300 ring-inset' : ''} ${
                  isSelected && !isToday ? 'bg-blue-50 ring-1 ring-blue-300 ring-inset' : ''
                } ${day ? 'cursor-pointer hover:bg-gray-50/80' : ''}`}
              >
                {day && (
                  <>
                    <div className={`text-xs font-medium mb-1 flex items-center justify-between ${
                      isToday ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      <span className={`${isToday ? 'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs' : ''}`}>
                        {day}
                      </span>
                      {isToday && <span className="text-[10px] text-blue-500 font-medium">Today</span>}
                    </div>
                    <div className="space-y-0.5">
                      {/* Holidays (Hebrew + Canadian) */}
                      {holidaysForDay.map((holiday) => (
                        <div
                          key={holiday.id}
                          className={`text-[10px] p-1 rounded ${getHolidayColor(holiday)}`}
                          title={`${holiday.name}${holiday.source === 'hebrew' ? ` (${(holiday as HebrewHoliday).hebrewName})` : ''} - ${holiday.description}`}
                        >
                          <div className="truncate font-medium flex items-center space-x-0.5">
                            <span>{getHolidayIcon(holiday)}</span>
                            <span>{holiday.name.length > 10 ? `${holiday.name.substring(0, 10)}...` : holiday.name}</span>
                          </div>
                        </div>
                      ))}

                      {/* Team Off Days / Vacations */}
                      {offDaysForDay.length > 0 && (
                        <div
                          className="text-[10px] p-1 rounded bg-amber-50 text-amber-700 border border-amber-200"
                          title={offDaysForDay.map(od => `${od.userName} - ${getOffDayLabel(od.reason)}${od.notes ? `: ${od.notes}` : ''}`).join('\n')}
                        >
                          <div className="truncate font-medium flex items-center space-x-0.5">
                            <Umbrella className="w-2.5 h-2.5 flex-shrink-0" />
                            {offDaysForDay.length === 1 ? (
                              <span>{offDaysForDay[0].userName.split(' ')[0]} - {getOffDayLabel(offDaysForDay[0].reason)}</span>
                            ) : (
                              <span>{offDaysForDay.length} team off</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Meetings */}
                      {meetingsForDay.map((meeting) => (
                        <div
                          key={meeting.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMeetingClick(meeting)
                          }}
                          className="text-[10px] p-1 rounded cursor-pointer hover:opacity-90 transition-all bg-blue-100 text-blue-800 border border-blue-200"
                          title={`${meeting.title} - ${formatMeetingTime(meeting.startTime)}${meeting.project ? ` - ${meeting.project.name}` : ''}`}
                        >
                          <div className="truncate font-medium flex items-center space-x-0.5">
                            <Video className="w-2.5 h-2.5 flex-shrink-0" />
                            <span>{formatMeetingTime(meeting.startTime)} {meeting.title.length > 8 ? `${meeting.title.substring(0, 8)}...` : meeting.title}</span>
                          </div>
                          {meeting.project && (
                            <div className="truncate text-[9px] text-blue-600">
                              {meeting.project.name}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Tasks */}
                      {tasksForDay.slice(0, maxTaskSlots).map((task) => {
                        // Build the correct link
                        let taskLink = `/stages/${task.id}`
                        if (task.id.includes('-room-due')) {
                          taskLink = '#'
                        } else if (task.type === 'task') {
                          const actualId = task.id.replace(/^task-/, '').replace(/-due$/, '')
                          taskLink = `/tasks/${actualId}`
                        }

                        const PhaseIcon = getPhaseIcon(task.stageType)

                        return (
                          <Link key={task.id} href={taskLink}>
                            <div
                              className="text-[10px] p-1 rounded cursor-pointer hover:bg-gray-200 transition-all bg-gray-100 text-gray-700 border border-gray-200"
                              title={`${task.title} - ${task.projectName} - Due: ${formatDate(task.dueDate)}${task.assignedUser ? ` - Assigned to: ${task.assignedUser.name}` : ''}`}
                            >
                              <div className="truncate font-medium flex items-center space-x-0.5">
                                <PhaseIcon className="w-2.5 h-2.5 flex-shrink-0 text-gray-500" />
                                <span>{task.title.length > 12 ? `${task.title.substring(0, 12)}...` : task.title}</span>
                              </div>
                              <div className="truncate text-[9px] text-gray-500">
                                {task.projectName}
                              </div>
                            </div>
                          </Link>
                        )
                      })}

                      {/* Show more indicator */}
                      {(tasksForDay.length > maxTaskSlots) && (
                        <div className="text-[10px] text-gray-500 p-0.5 flex items-center">
                          <Eye className="w-2.5 h-2.5 mr-0.5" />
                          +{tasksForDay.length - maxTaskSlots} more
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

      {/* Day Detail Panel with Hourly Time Slots */}
      {selectedDay !== null && (() => {
        const dayTasks = getTasksForDate(selectedDay)
        const dayHolidays = getHolidaysForDate(selectedDay)
        const dayOffDays = getOffDaysForDate(selectedDay)
        const dayMeetings = getMeetingsForDate(selectedDay)
        const selectedDate = new Date(currentYear, currentMonth, selectedDay)
        const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

        // Time slot hours: 9 AM to 6 PM
        const timeSlotHours = Array.from({ length: 10 }, (_, i) => i + 9) // 9, 10, 11, ... 18
        const SLOT_HEIGHT = 52 // px per hour slot, matches min-h-[52px]
        const GRID_START_HOUR = 9

        // Format hour for display
        const formatHour = (hour: number) => {
          if (hour === 0) return '12 AM'
          if (hour < 12) return `${hour} AM`
          if (hour === 12) return '12 PM'
          return `${hour - 12} PM`
        }

        // Calculate meeting position & height in pixels relative to the grid
        const getMeetingStyle = (meeting: MeetingItem) => {
          const start = new Date(meeting.startTime)
          const end = new Date(meeting.endTime)
          const startFraction = start.getHours() + start.getMinutes() / 60
          const endFraction = end.getHours() + end.getMinutes() / 60
          const top = (startFraction - GRID_START_HOUR) * SLOT_HEIGHT
          const height = Math.max((endFraction - startFraction) * SLOT_HEIGHT, 40) // min 40px
          return { top, height }
        }

        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4 overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">{dateStr}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddOffDayForDay(selectedDay)
                  }}
                >
                  <Umbrella className="w-3.5 h-3.5" />
                  Add Vacation
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleScheduleForDay(selectedDay)
                  }}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Schedule Meeting
                </Button>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Holidays & Off Days (above time grid) */}
            {(dayHolidays.length > 0 || dayOffDays.length > 0) && (
              <div className="px-5 py-3 border-b border-gray-100 space-y-2">
                {dayHolidays.map(holiday => (
                  <div key={holiday.id} className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-100">
                    <span className="text-base">{getHolidayIcon(holiday)}</span>
                    <div>
                      <p className="text-sm font-medium text-purple-900">{holiday.name}</p>
                      <p className="text-xs text-purple-600">{holiday.description}</p>
                    </div>
                  </div>
                ))}
                {dayOffDays.map(od => (
                  <div key={od.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <Umbrella className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">{od.userName}</p>
                      <p className="text-xs text-amber-600">{getOffDayLabel(od.reason)}{od.notes ? ` — ${od.notes}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Time Slot Grid (9 AM - 6 PM) */}
            <div className="flex">
              {/* Time labels column */}
              <div className="w-16 flex-shrink-0 border-r border-gray-100">
                {timeSlotHours.map(hour => {
                  const isNow = todayRef.date === selectedDay &&
                                todayRef.month === currentMonth &&
                                todayRef.year === currentYear &&
                                new Date().getHours() === hour
                  return (
                    <div
                      key={hour}
                      className={`h-[52px] px-2 flex items-start justify-end pt-1 text-[11px] font-medium ${
                        isNow ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    >
                      <div className="text-right">
                        {formatHour(hour)}
                        {isNow && (
                          <div className="text-[9px] text-blue-500">Now</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Content area with absolute positioned meetings */}
              <div className="flex-1 relative" style={{ height: timeSlotHours.length * SLOT_HEIGHT }}>
                {/* Hour grid lines */}
                {timeSlotHours.map((hour, idx) => {
                  const isNow = todayRef.date === selectedDay &&
                                todayRef.month === currentMonth &&
                                todayRef.year === currentYear &&
                                new Date().getHours() === hour
                  return (
                    <div
                      key={hour}
                      className={`absolute left-0 right-0 border-b border-gray-100 ${
                        isNow ? 'bg-blue-50/40' : ''
                      }`}
                      style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                    />
                  )
                })}

                {/* Now indicator line */}
                {todayRef.date === selectedDay &&
                 todayRef.month === currentMonth &&
                 todayRef.year === currentYear && (() => {
                  const now = new Date()
                  const nowFraction = now.getHours() + now.getMinutes() / 60
                  if (nowFraction >= GRID_START_HOUR && nowFraction <= GRID_START_HOUR + timeSlotHours.length) {
                    const top = (nowFraction - GRID_START_HOUR) * SLOT_HEIGHT
                    return (
                      <div
                        className="absolute left-0 right-0 z-10 flex items-center"
                        style={{ top }}
                      >
                        <div className="w-2 h-2 rounded-full bg-blue-500 -ml-1" />
                        <div className="flex-1 h-[1.5px] bg-blue-500" />
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Meetings — absolutely positioned */}
                {dayMeetings.map(meeting => {
                  const { top, height } = getMeetingStyle(meeting)
                  const locationIcon = meeting.locationType === 'VIRTUAL' ? (
                    <Video className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                  )

                  return (
                    <div
                      key={meeting.id}
                      className="absolute left-2 right-2 z-20"
                      style={{ top, height }}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMeetingClick(meeting)
                        }}
                        className="h-full flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer hover:shadow-md transition-all border bg-blue-50 border-blue-200 text-gray-900 hover:bg-blue-100 overflow-hidden"
                      >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-500 text-white">
                          {meeting.locationType === 'VIRTUAL' ? (
                            <Video className="w-3.5 h-3.5" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-gray-900">
                            {meeting.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span>{formatMeetingTime(meeting.startTime)} — {formatMeetingTime(meeting.endTime)}</span>
                          </div>
                          {height > 50 && (
                            <>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                                {locationIcon}
                                <span className="truncate">
                                  {meeting.locationDetails || (meeting.locationType === 'VIRTUAL' ? 'Virtual' : meeting.locationType === 'OUR_OFFICE' ? 'Our Office' : 'On Site')}
                                </span>
                                {meeting.project && (
                                  <span className="ml-1 text-blue-600">• {meeting.project.name}</span>
                                )}
                              </div>
                              {meeting.attendees.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                                  <Users className="w-3 h-3" />
                                  <span>{meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 flex-shrink-0 mt-1 text-gray-400" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tasks section (below time grid) */}
            {dayTasks.length > 0 && (
              <div className="border-t border-gray-200 px-5 py-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tasks ({dayTasks.length})</h4>
                <div className="space-y-1.5">
                  {dayTasks.map(task => {
                    let taskLink = `/stages/${task.id}`
                    if (task.id.includes('-room-due')) {
                      taskLink = '#'
                    } else if (task.type === 'task') {
                      const actualId = task.id.replace(/^task-/, '').replace(/-due$/, '')
                      taskLink = `/tasks/${actualId}`
                    }

                    const PhaseIcon = getPhaseIcon(task.stageType)
                    const phaseConf = phaseConfig[task.stageType || '']

                    return (
                      <Link key={task.id} href={taskLink}>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100/70 transition-colors">
                          <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center flex-shrink-0 ${phaseConf?.color || 'bg-gray-500'}`}>
                            <PhaseIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {task.projectName}
                              {task.assignedUser && <span className="ml-1.5">• {task.assignedUser.name}</span>}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Empty State */}
      {filteredTasks.length === 0 && meetingItems.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center mt-4">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">
            {viewMode === 'mine' ? 'No tasks assigned to you' : 'No scheduled tasks or meetings'}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {viewMode === 'mine'
              ? 'Switch to "All Tasks" to see team tasks.'
              : 'Add due dates to your project stages or schedule a meeting to see them here.'}
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

      {/* Meeting Detail Dialog */}
      <MeetingDetailDialog
        meeting={selectedMeeting}
        open={meetingDetailOpen}
        onOpenChange={setMeetingDetailOpen}
        onEdit={handleEditMeeting}
        onRefresh={handleMeetingSuccess}
      />

      {/* Edit Meeting Dialog (hidden, triggered programmatically) */}
      {editMeeting && (
        <ScheduleMeetingDialog
          projects={projectList}
          editMeeting={editMeeting}
          onSuccess={handleMeetingSuccess}
          trigger={<span />}
        />
      )}

      {/* Schedule Meeting from Day Click */}
      <ScheduleMeetingDialog
        projects={projectList}
        defaultDate={scheduleMeetingDate}
        open={scheduleMeetingOpen}
        onOpenChange={(isOpen) => {
          setScheduleMeetingOpen(isOpen)
          if (!isOpen) setScheduleMeetingDate(null)
        }}
        onSuccess={handleMeetingSuccess}
        trigger={<span className="hidden" />}
      />

      {/* Add Off Day from Day Click */}
      <AddOffDayDialog
        defaultDate={addOffDayDate}
        open={addOffDayOpen}
        onOpenChange={(isOpen) => {
          setAddOffDayOpen(isOpen)
          if (!isOpen) setAddOffDayDate(null)
        }}
        onSuccess={() => {
          window.location.reload()
        }}
        currentUser={{
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role || 'VIEWER',
        }}
      />
    </div>
  )
}
