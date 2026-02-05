'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Palmtree,
  Thermometer,
  User,
  Building,
  HelpCircle,
  CalendarOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface OffDaysProps {
  userId: string
  isOwnerOrAdmin: boolean
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

const OFF_DAY_REASONS = [
  { value: 'VACATION', label: 'Vacation', icon: Palmtree, color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'SICK', label: 'Sick Day', icon: Thermometer, color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'PERSONAL', label: 'Personal', icon: User, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'HOLIDAY', label: 'Holiday', icon: Building, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, color: 'bg-gray-100 text-gray-700 border-gray-200' }
]

export function OffDays({ userId, isOwnerOrAdmin }: OffDaysProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [reason, setReason] = useState('VACATION')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  // Get date range for current month view (include some days from prev/next month)
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  // Extend range for calendar view
  const startDate = new Date(monthStart)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  const endDate = new Date(monthEnd)
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

  const { data, error, isLoading, mutate } = useSWR(
    `/api/timeline/off-days?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
    fetcher
  )

  const offDays = data?.offDays || []
  const offDayMap = new Map(offDays.map((od: any) => [od.date, od]))

  // Generate calendar days
  const calendarDays: Date[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    calendarDays.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === 'prev' ? -1 : 1))
    setSelectedMonth(newMonth)
  }

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const existingOffDay = offDayMap.get(dateStr)

    if (existingOffDay) {
      // Show confirmation to remove
      if (confirm(`Remove ${formatDate(date)} as an off day?`)) {
        handleDeleteOffDay(existingOffDay.id)
      }
    } else {
      // Open modal to add
      setSelectedDate(dateStr)
      setReason('VACATION')
      setNotes('')
      setShowAddModal(true)
    }
  }

  const handleAddOffDay = async () => {
    if (!selectedDate) return

    try {
      setSaving(true)
      const response = await fetch('/api/timeline/off-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          reason,
          notes: notes.trim() || null
        })
      })

      if (!response.ok) throw new Error('Failed to add off day')

      toast.success('Off day added')
      setShowAddModal(false)
      mutate()
    } catch (error) {
      toast.error('Failed to add off day')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOffDay = async (id: string) => {
    try {
      const response = await fetch(`/api/timeline/off-days?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove off day')

      toast.success('Off day removed')
      mutate()
    } catch (error) {
      toast.error('Failed to remove off day')
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  const formatMonthYear = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric'
    }).format(date)
  }

  const getReasonConfig = (reason: string) => {
    return OFF_DAY_REASONS.find(r => r.value === reason) || OFF_DAY_REASONS[4]
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === selectedMonth.getMonth()
  }

  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">
          Failed to load off days. Please try again.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Off Days</h2>
          <p className="text-sm text-gray-500">
            Mark days when you're away to avoid timesheet reminders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
          >
            {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedDate(new Date().toISOString().split('T')[0])
              setReason('VACATION')
              setNotes('')
              setShowAddModal(true)
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Off Day
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {OFF_DAY_REASONS.map(r => {
          const Icon = r.icon
          return (
            <div key={r.value} className={cn('flex items-center gap-1.5 px-2 py-1 rounded text-xs border', r.color)}>
              <Icon className="w-3 h-3" />
              {r.label}
            </div>
          )
        })}
      </div>

      {viewMode === 'calendar' ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-lg">{formatMonthYear(selectedMonth)}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, idx) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const offDay = offDayMap.get(dateStr)
                    const reasonConfig = offDay ? getReasonConfig(offDay.reason) : null
                    const Icon = reasonConfig?.icon

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDayClick(date)}
                        className={cn(
                          'aspect-square p-1 rounded-lg text-sm transition-all relative',
                          'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500',
                          !isCurrentMonth(date) && 'text-gray-300',
                          isToday(date) && 'ring-2 ring-cyan-500',
                          isWeekend(date) && !offDay && 'bg-gray-50',
                          offDay && reasonConfig?.color
                        )}
                      >
                        <span className={cn(
                          'block text-center',
                          offDay && 'font-medium'
                        )}>
                          {date.getDate()}
                        </span>
                        {offDay && Icon && (
                          <Icon className="w-3 h-3 mx-auto mt-0.5" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Off Days</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : offDays.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarOff className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No off days recorded</p>
                <p className="text-sm mt-1">Click "Add Off Day" to mark days when you're away</p>
              </div>
            ) : (
              <div className="space-y-2">
                {offDays.map((od: any) => {
                  const reasonConfig = getReasonConfig(od.reason)
                  const Icon = reasonConfig.icon

                  return (
                    <div
                      key={od.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        reasonConfig.color
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <div>
                          <p className="font-medium">
                            {formatDate(new Date(od.date + 'T00:00:00'))}
                          </p>
                          <p className="text-sm opacity-75">
                            {reasonConfig.label}
                            {od.notes && ` - ${od.notes}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Remove this off day?')) {
                            handleDeleteOffDay(od.id)
                          }
                        }}
                        className="text-current hover:bg-white/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {OFF_DAY_REASONS.map(r => {
              const count = offDays.filter((od: any) => od.reason === r.value).length
              const Icon = r.icon
              return (
                <div key={r.value} className="text-center p-3 rounded-lg bg-gray-50">
                  <Icon className="w-5 h-5 mx-auto mb-1 text-gray-500" />
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">{r.label}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Off Day Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Off Day</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFF_DAY_REASONS.map(r => {
                    const Icon = r.icon
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {r.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Doctor's appointment, family vacation..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddOffDay} disabled={!selectedDate || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Off Day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
