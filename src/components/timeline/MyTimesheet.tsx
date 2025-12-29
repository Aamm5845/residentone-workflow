'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TimeEntryModal } from './TimeEntryModal'
import { formatDuration } from '@/contexts/TimerContext'
import { 
  Plus, 
  Calendar, 
  CalendarDays,
  Clock, 
  FolderOpen, 
  Home, 
  Layers,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  List,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'

interface MyTimesheetProps {
  userId: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Work hours configuration
const WORK_START_HOUR = 9  // 9 AM
const WORK_END_HOUR = 18   // 6 PM
const EXPECTED_DAILY_HOURS = 8

export function MyTimesheet({ userId }: MyTimesheetProps) {
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'hourly'>('list')

  // Get week start and end
  const weekStart = new Date(selectedDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const startDate = weekStart.toISOString().split('T')[0]
  const endDate = weekEnd.toISOString().split('T')[0]

  const { data, error, isLoading, mutate } = useSWR(
    `/api/timeline/entries?userId=${userId}&startDate=${startDate}&endDate=${endDate}`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const entries = data?.entries || []

  // Group entries by date
  const entriesByDate: Record<string, any[]> = {}
  entries.forEach((entry: any) => {
    const date = entry.startTime.split('T')[0]
    if (!entriesByDate[date]) {
      entriesByDate[date] = []
    }
    entriesByDate[date].push(entry)
  })

  // Generate week days
  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    weekDays.push(date)
  }

  // Calculate totals
  const totalMinutes = entries.reduce((sum: number, e: any) => sum + (e.duration || e.calculatedDuration || 0), 0)
  const dailyTotals: Record<string, number> = {}
  entries.forEach((entry: any) => {
    const date = entry.startTime.split('T')[0]
    dailyTotals[date] = (dailyTotals[date] || 0) + (entry.duration || entry.calculatedDuration || 0)
  })

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7))
    setSelectedDate(newDate)
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return

    try {
      const response = await fetch(`/api/timeline/entries/${entryId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        mutate()
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatStageType = (type: string) => {
    return getStageName(type)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Calculate hourly coverage for a given day
  const getHourlyCoverage = (dateStr: string) => {
    const dayEntries = entriesByDate[dateStr] || []
    const hourCoverage: Record<number, { minutes: number; entries: any[] }> = {}
    
    // Initialize all work hours
    for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
      hourCoverage[h] = { minutes: 0, entries: [] }
    }
    
    dayEntries.forEach((entry: any) => {
      const start = new Date(entry.startTime)
      const end = entry.endTime ? new Date(entry.endTime) : new Date()
      
      // Calculate minutes covered in each hour
      for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
        const hourStart = new Date(start)
        hourStart.setHours(h, 0, 0, 0)
        const hourEnd = new Date(start)
        hourEnd.setHours(h + 1, 0, 0, 0)
        
        // Check if entry overlaps with this hour
        if (start < hourEnd && end > hourStart) {
          const overlapStart = Math.max(start.getTime(), hourStart.getTime())
          const overlapEnd = Math.min(end.getTime(), hourEnd.getTime())
          const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000)
          
          if (overlapMinutes > 0) {
            hourCoverage[h].minutes += overlapMinutes
            hourCoverage[h].entries.push(entry)
          }
        }
      }
    })
    
    return hourCoverage
  }

  // Calculate daily stats
  const getDailyStats = (dateStr: string) => {
    const dayMinutes = dailyTotals[dateStr] || 0
    const expectedMinutes = EXPECTED_DAILY_HOURS * 60
    const percentComplete = Math.min(100, Math.round((dayMinutes / expectedMinutes) * 100))
    const isComplete = dayMinutes >= expectedMinutes
    const missingMinutes = Math.max(0, expectedMinutes - dayMinutes)
    
    return { dayMinutes, expectedMinutes, percentComplete, isComplete, missingMinutes }
  }

  // Format hour for display
  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h = hour % 12 || 12
    return `${h}${ampm}`
  }

  return (
    <div className="space-y-6">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-medium">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Week Total: <span className="font-semibold text-gray-900">{formatDuration(totalMinutes)}</span>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn(
                "rounded-none",
                viewMode === 'list' && "bg-cyan-600 hover:bg-cyan-700"
              )}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
            <Button 
              variant={viewMode === 'hourly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('hourly')}
              className={cn(
                "rounded-none",
                viewMode === 'hourly' && "bg-cyan-600 hover:bg-cyan-700"
              )}
            >
              <CalendarDays className="w-4 h-4 mr-1" />
              Hourly
            </Button>
          </div>
          
          <Button 
            onClick={() => setShowModal(true)}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Week Overview */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0]
          const dayMinutes = dailyTotals[dateStr] || 0
          const dayEntries = entriesByDate[dateStr] || []
          
          return (
            <Card
              key={dateStr}
              className={cn(
                "text-center cursor-pointer hover:border-cyan-300 transition-colors",
                isToday(day) && "border-cyan-500 bg-cyan-50",
                selectedDate.toDateString() === day.toDateString() && !isToday(day) && "border-cyan-400 bg-cyan-50/50"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <CardContent className="p-3">
                <div className="text-xs text-gray-500 uppercase">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  isToday(day) ? "text-cyan-700" : "text-gray-900"
                )}>
                  {day.getDate()}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {dayMinutes > 0 ? formatDuration(dayMinutes) : '-'}
                </div>
                <div className="text-xs text-gray-400">
                  {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Hourly Calendar View - Daily Timeline */}
      {viewMode === 'hourly' && (
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(entriesByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, dayEntries]) => {
                const stats = getDailyStats(date)
                const totalWorkMinutes = (WORK_END_HOUR - WORK_START_HOUR) * 60
                
                // Calculate entry positions on timeline
                const getEntryPosition = (entry: any) => {
                  const start = new Date(entry.startTime)
                  const end = entry.endTime ? new Date(entry.endTime) : new Date()
                  
                  const startHour = start.getHours() + start.getMinutes() / 60
                  const endHour = end.getHours() + end.getMinutes() / 60
                  
                  // Clamp to work hours
                  const clampedStart = Math.max(WORK_START_HOUR, Math.min(WORK_END_HOUR, startHour))
                  const clampedEnd = Math.max(WORK_START_HOUR, Math.min(WORK_END_HOUR, endHour))
                  
                  const leftPercent = ((clampedStart - WORK_START_HOUR) / (WORK_END_HOUR - WORK_START_HOUR)) * 100
                  const widthPercent = ((clampedEnd - clampedStart) / (WORK_END_HOUR - WORK_START_HOUR)) * 100
                  
                  return { leftPercent, widthPercent, startHour, endHour }
                }
                
                return (
                  <Card key={date}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3 text-base">
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                          {stats.isComplete ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-normal">
                              <CheckCircle2 className="w-3 h-3" />
                              Complete
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-normal">
                              <AlertCircle className="w-3 h-3" />
                              {stats.percentComplete}%
                            </span>
                          )}
                        </CardTitle>
                        <span className="text-sm text-gray-500">
                          {formatDuration(stats.dayMinutes)} / {EXPECTED_DAILY_HOURS}h
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Hour Labels */}
                      <div className="flex border-b border-gray-200 mb-2">
                        {Array.from({ length: WORK_END_HOUR - WORK_START_HOUR + 1 }, (_, i) => WORK_START_HOUR + i).map(hour => (
                          <div 
                            key={hour} 
                            className="flex-1 text-xs text-gray-500 text-center pb-1"
                            style={{ marginLeft: hour === WORK_START_HOUR ? 0 : undefined }}
                          >
                            {formatHour(hour)}
                          </div>
                        ))}
                      </div>
                      
                      {/* Timeline Grid */}
                      <div className="relative">
                        {/* Hour Grid Lines */}
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: WORK_END_HOUR - WORK_START_HOUR }, (_, i) => (
                            <div key={i} className="flex-1 border-l border-gray-100 first:border-l-0" />
                          ))}
                          <div className="border-l border-gray-100" />
                        </div>
                        
                        {/* Timeline Background */}
                        <div className="h-16 bg-gray-50 rounded relative">
                          {/* Entry Blocks */}
                          {dayEntries.map((entry: any, idx: number) => {
                            const pos = getEntryPosition(entry)
                            if (pos.widthPercent <= 0) return null
                            
                            const colors = [
                              'bg-cyan-500',
                              'bg-blue-500', 
                              'bg-purple-500',
                              'bg-green-500',
                              'bg-amber-500'
                            ]
                            const colorClass = colors[idx % colors.length]
                            
                            return (
                              <div
                                key={entry.id}
                                className={cn(
                                  "absolute top-1 bottom-1 rounded shadow-sm flex items-center justify-center overflow-hidden",
                                  colorClass
                                )}
                                style={{
                                  left: `${pos.leftPercent}%`,
                                  width: `${Math.max(pos.widthPercent, 2)}%`
                                }}
                                title={`${formatTime(entry.startTime)} - ${entry.endTime ? formatTime(entry.endTime) : 'ongoing'}\n${entry.project?.name || 'No project'}\n${formatDuration(entry.duration || entry.calculatedDuration || 0)}`}
                              >
                                {pos.widthPercent > 10 && (
                                  <span className="text-xs text-white font-medium truncate px-1">
                                    {entry.project?.name || 'Work'}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                          
                          {/* No entries message */}
                          {dayEntries.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                              No time logged
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Entry Details */}
                      {dayEntries.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {dayEntries.map((entry: any, idx: number) => {
                            const colors = [
                              'bg-cyan-500',
                              'bg-blue-500', 
                              'bg-purple-500',
                              'bg-green-500',
                              'bg-amber-500'
                            ]
                            const colorClass = colors[idx % colors.length]
                            
                            return (
                              <div key={entry.id} className="flex items-center gap-3 text-sm">
                                <div className={cn("w-3 h-3 rounded", colorClass)} />
                                <span className="text-gray-500 w-28">
                                  {formatTime(entry.startTime)} - {entry.endTime ? formatTime(entry.endTime) : 'now'}
                                </span>
                                <span className="font-medium text-gray-900 w-16">
                                  {formatDuration(entry.duration || entry.calculatedDuration || 0)}
                                </span>
                                <span className="text-gray-600 truncate flex-1">
                                  {entry.project?.name || 'No project'}
                                  {entry.stage && ` • ${formatStageType(entry.stage.type)}`}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-gray-600"
                                    onClick={() => setEditingEntry(entry.id)}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-red-600"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
          )}
          
          {/* Empty state */}
          {!isLoading && Object.keys(entriesByDate).length === 0 && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-gray-500">
                  <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>No time entries for this week</p>
                  <p className="text-sm mt-1">Click "Add Entry" to log your time</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Entries List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-600" />
              Time Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No time entries for this week</p>
                <p className="text-sm mt-1">Click "Add Entry" to log your time</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(entriesByDate)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, dayEntries]) => {
                    const stats = getDailyStats(date)
                    return (
                      <div key={date}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <h4 className="text-sm font-medium text-gray-700">
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </h4>
                            {stats.isComplete ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Complete
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                <AlertCircle className="w-3 h-3" />
                                {stats.percentComplete}% ({formatDuration(stats.missingMinutes)} remaining)
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatDuration(dailyTotals[date] || 0)} / {EXPECTED_DAILY_HOURS}h
                          </span>
                        </div>
                        <div className="space-y-2">
                          {dayEntries.map((entry: any) => (
                            <div 
                              key={entry.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-4">
                                  <div className="text-sm text-gray-500">
                                    {formatTime(entry.startTime)}
                                    {entry.endTime && ` - ${formatTime(entry.endTime)}`}
                                  </div>
                                  <div className="font-medium text-gray-900">
                                    {formatDuration(entry.duration || entry.calculatedDuration || 0)}
                                  </div>
                                  {entry.status !== 'STOPPED' && (
                                    <span className={cn(
                                      "text-xs px-2 py-0.5 rounded-full",
                                      entry.status === 'RUNNING' 
                                        ? "bg-green-100 text-green-700" 
                                        : "bg-yellow-100 text-yellow-700"
                                    )}>
                                      {entry.status === 'RUNNING' ? 'Running' : 'Paused'}
                                    </span>
                                  )}
                                  {entry.isManual && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                      Manual
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                  {entry.project && (
                                    <div className="flex items-center gap-1">
                                      <FolderOpen className="w-3 h-3" />
                                      {entry.project.name}
                                    </div>
                                  )}
                                  {entry.room && (
                                    <div className="flex items-center gap-1">
                                      <Home className="w-3 h-3" />
                                      {entry.room.name || entry.room.type.replace(/_/g, ' ')}
                                    </div>
                                  )}
                                  {entry.stage && (
                                    <div className="flex items-center gap-1">
                                      <Layers className="w-3 h-3" />
                                      {formatStageType(entry.stage.type)}
                                    </div>
                                  )}
                                </div>
                                {entry.description && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {entry.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-gray-600"
                                  onClick={() => setEditingEntry(entry.id)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-600"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TimeEntryModal 
        isOpen={showModal || !!editingEntry} 
        onClose={() => {
          setShowModal(false)
          setEditingEntry(null)
        }}
        onSuccess={() => mutate()}
        entryId={editingEntry}
      />
    </div>
  )
}
