'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDuration } from '@/contexts/TimerContext'
import { Clock, Loader2, CheckSquare, Square, Calendar } from 'lucide-react'

interface TimeEntry {
  id: string
  userId: string
  userName: string
  userImage: string | null
  description: string | null
  startTime: string
  endTime: string | null
  duration: number
  durationHours: number
  room: { id: string; name: string; type: string } | null
  stage: { id: string; type: string } | null
}

interface UnbilledSummary {
  totalUnbilledMinutes: number
  totalUnbilledHours: number
  entryCount: number
  hourlyRate: number | null
  estimatedAmount: number | null
}

interface TimeEntrySelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  excludeEntryIds?: string[]
  onSelect: (selectedIds: string[], totalHours: number) => void
}

type DatePreset = 'all' | 'this-week' | 'last-week' | 'this-month' | 'last-month'

export default function TimeEntrySelector({
  open,
  onOpenChange,
  projectId,
  excludeEntryIds = [],
  onSelect,
}: TimeEntrySelectorProps) {
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [summary, setSummary] = useState<UnbilledSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [userFilter, setUserFilter] = useState<string>('all')

  // Fetch unbilled entries when dialog opens
  useEffect(() => {
    if (!open) return

    const fetchEntries = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ projectId })

        // Date filters based on preset
        const now = new Date()
        if (datePreset === 'this-week') {
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          params.set('startDate', weekStart.toISOString().split('T')[0])
          params.set('endDate', now.toISOString().split('T')[0])
        } else if (datePreset === 'last-week') {
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)
          params.set('startDate', weekStart.toISOString().split('T')[0])
          params.set('endDate', weekEnd.toISOString().split('T')[0])
        } else if (datePreset === 'this-month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          params.set('startDate', monthStart.toISOString().split('T')[0])
          params.set('endDate', now.toISOString().split('T')[0])
        } else if (datePreset === 'last-month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
          params.set('startDate', monthStart.toISOString().split('T')[0])
          params.set('endDate', monthEnd.toISOString().split('T')[0])
        }

        const res = await fetch(`/api/billing/unbilled-hours?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          // Filter out excluded entries
          const filtered = (data.entries as TimeEntry[]).filter(
            e => !excludeEntryIds.includes(e.id)
          )
          setEntries(filtered)
          setSummary(data.summary)
        }
      } catch (error) {
        console.error('Error fetching unbilled entries:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
    setSelectedIds(new Set())
  }, [open, projectId, datePreset, excludeEntryIds])

  // Get unique users for filter
  const users = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach(e => map.set(e.userId, e.userName))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [entries])

  // Apply user filter
  const filteredEntries = useMemo(() => {
    if (userFilter === 'all') return entries
    return entries.filter(e => e.userId === userFilter)
  }, [entries, userFilter])

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, TimeEntry[]> = {}
    filteredEntries.forEach(entry => {
      const date = entry.startTime.split('T')[0]
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredEntries])

  // Calculate selected hours
  const selectedHours = useMemo(() => {
    const selectedMinutes = filteredEntries
      .filter(e => selectedIds.has(e.id))
      .reduce((sum, e) => sum + (e.duration || 0), 0)
    return Math.round((selectedMinutes / 60) * 100) / 100
  }, [filteredEntries, selectedIds])

  const selectedCount = selectedIds.size

  const toggleEntry = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)))
    }
  }

  const handleConfirm = () => {
    onSelect(Array.from(selectedIds), selectedHours)
    onOpenChange(false)
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Select Unbilled Time Entries
          </DialogTitle>
          <DialogDescription>
            Choose time entries to link to this hourly line item.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-3 border-b pb-3">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
            </SelectContent>
          </Select>

          {users.length > 1 && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedIds.size === filteredEntries.length && filteredEntries.length > 0 ? (
                <><Square className="w-4 h-4 mr-1" /> Deselect All</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-1" /> Select All</>
              )}
            </Button>
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">No unbilled entries found</p>
              <p className="text-sm mt-1">Try adjusting the date range or filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedEntries.map(([date, dayEntries]) => (
                <div key={date}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">
                      {formatDate(date)}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {formatDuration(dayEntries.reduce((s, e) => s + (e.duration || 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEntries.map(entry => (
                      <label
                        key={entry.id}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onCheckedChange={() => toggleEntry(entry.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">
                              {formatTime(entry.startTime)}
                              {entry.endTime && ` - ${formatTime(entry.endTime)}`}
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatDuration(entry.duration || 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                            <span>{entry.userName}</span>
                            {entry.room && (
                              <span className="text-gray-400">
                                {entry.room.name || entry.room.type}
                              </span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {entry.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with selection summary */}
        <DialogFooter className="border-t pt-3">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-600">
              {selectedCount > 0 ? (
                <span>
                  <span className="font-semibold text-blue-600">{selectedCount}</span> entries selected
                  {' '}({selectedHours} hrs)
                  {summary?.hourlyRate && (
                    <span className="text-gray-400 ml-1">
                      ~ ${(selectedHours * summary.hourlyRate).toLocaleString()}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400">No entries selected</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
              >
                Add {selectedCount} {selectedCount === 1 ? 'Entry' : 'Entries'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
