'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { Clock, Loader2, CheckSquare, Square, Calendar, ChevronDown, ChevronRight, CheckCircle2, Home } from 'lucide-react'
import { getStageName } from '@/constants/workflow'

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

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DESIGN_CONCEPT: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  DESIGN: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  THREE_D: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  DRAWINGS: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  FFE: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  CLIENT_APPROVAL: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  _NONE: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
}

function roundToHalfHour(minutes: number): number {
  return Math.round((minutes / 60) * 2) / 2
}

interface PhaseGroup {
  phaseKey: string
  phaseName: string
  rooms: RoomGroup[]
  entries: TimeEntry[]
  totalMinutes: number
  totalHours: number
}

interface RoomGroup {
  roomKey: string
  roomName: string
  entries: TimeEntry[]
  totalMinutes: number
  totalHours: number
}

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
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())
  const [markingBilled, setMarkingBilled] = useState(false)

  // Fetch unbilled entries when dialog opens
  useEffect(() => {
    if (!open) return

    const fetchEntries = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ projectId })

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
    setCollapsedPhases(new Set())
  }, [open, projectId, datePreset, excludeEntryIds])

  // Get unique users
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

  // Group entries by phase, then by room within each phase
  const phaseGroups = useMemo((): PhaseGroup[] => {
    const phaseMap: Record<string, { entries: TimeEntry[]; roomMap: Record<string, TimeEntry[]> }> = {}

    filteredEntries.forEach(entry => {
      const phaseKey = entry.stage?.type || '_NONE'
      if (!phaseMap[phaseKey]) {
        phaseMap[phaseKey] = { entries: [], roomMap: {} }
      }
      phaseMap[phaseKey].entries.push(entry)

      const roomKey = entry.room ? entry.room.id : '_NO_ROOM'
      if (!phaseMap[phaseKey].roomMap[roomKey]) {
        phaseMap[phaseKey].roomMap[roomKey] = []
      }
      phaseMap[phaseKey].roomMap[roomKey].push(entry)
    })

    // Convert to sorted array
    const phaseOrder = ['DESIGN_CONCEPT', 'DESIGN', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE', '_NONE']

    return Object.entries(phaseMap)
      .sort(([a], [b]) => {
        const ai = phaseOrder.indexOf(a)
        const bi = phaseOrder.indexOf(b)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      .map(([phaseKey, data]) => {
        const totalMinutes = data.entries.reduce((s, e) => s + (e.duration || 0), 0)
        const rooms: RoomGroup[] = Object.entries(data.roomMap)
          .map(([roomKey, roomEntries]) => {
            const roomTotalMinutes = roomEntries.reduce((s, e) => s + (e.duration || 0), 0)
            const firstWithRoom = roomEntries.find(e => e.room)
            return {
              roomKey,
              roomName: firstWithRoom?.room?.name || firstWithRoom?.room?.type?.replace(/_/g, ' ') || 'No Room',
              entries: roomEntries.sort((a, b) => b.startTime.localeCompare(a.startTime)),
              totalMinutes: roomTotalMinutes,
              totalHours: roundToHalfHour(roomTotalMinutes),
            }
          })
          .sort((a, b) => b.totalMinutes - a.totalMinutes)

        return {
          phaseKey,
          phaseName: phaseKey === '_NONE' ? 'General' : getStageName(phaseKey),
          rooms,
          entries: data.entries,
          totalMinutes,
          totalHours: roundToHalfHour(totalMinutes),
        }
      })
  }, [filteredEntries])

  // Calculate selected hours (rounded to half-hour)
  const selectedHours = useMemo(() => {
    const selectedMinutes = filteredEntries
      .filter(e => selectedIds.has(e.id))
      .reduce((sum, e) => sum + (e.duration || 0), 0)
    return roundToHalfHour(selectedMinutes)
  }, [filteredEntries, selectedIds])

  const selectedCount = selectedIds.size

  const toggleEntry = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePhase = (phaseEntries: TimeEntry[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = phaseEntries.every(e => next.has(e.id))
      if (allSelected) {
        phaseEntries.forEach(e => next.delete(e.id))
      } else {
        phaseEntries.forEach(e => next.add(e.id))
      }
      return next
    })
  }

  const toggleRoom = (roomEntries: TimeEntry[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = roomEntries.every(e => next.has(e.id))
      if (allSelected) {
        roomEntries.forEach(e => next.delete(e.id))
      } else {
        roomEntries.forEach(e => next.add(e.id))
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

  const toggleCollapse = (phaseKey: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseKey)) next.delete(phaseKey)
      else next.add(phaseKey)
      return next
    })
  }

  const handleConfirm = () => {
    onSelect(Array.from(selectedIds), selectedHours)
    onOpenChange(false)
  }

  const handleMarkAsBilled = async () => {
    if (selectedCount === 0) return
    setMarkingBilled(true)
    try {
      const res = await fetch('/api/billing/mark-billed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds: Array.from(selectedIds) }),
      })
      if (res.ok) {
        // Remove billed entries from the list
        setEntries(prev => prev.filter(e => !selectedIds.has(e.id)))
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error('Error marking as billed:', error)
    } finally {
      setMarkingBilled(false)
    }
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
      month: 'short',
      day: 'numeric',
    })
  }

  const getPhaseColors = (phaseKey: string) => {
    return PHASE_COLORS[phaseKey] || PHASE_COLORS._NONE
  }

  const isPhaseAllSelected = (entries: TimeEntry[]) => {
    return entries.length > 0 && entries.every(e => selectedIds.has(e.id))
  }

  const isPhaseSomeSelected = (entries: TimeEntry[]) => {
    return entries.some(e => selectedIds.has(e.id)) && !entries.every(e => selectedIds.has(e.id))
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
            Select by phase, room, or individual entries. Hours are rounded to the nearest half-hour.
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

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedIds.size === filteredEntries.length && filteredEntries.length > 0 ? (
                <><Square className="w-4 h-4 mr-1" /> Deselect All</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-1" /> Select All</>
              )}
            </Button>
          </div>
        </div>

        {/* Entries grouped by Phase > Room */}
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
            <div className="space-y-3">
              {phaseGroups.map(phase => {
                const colors = getPhaseColors(phase.phaseKey)
                const isCollapsed = collapsedPhases.has(phase.phaseKey)
                const allSelected = isPhaseAllSelected(phase.entries)
                const someSelected = isPhaseSomeSelected(phase.entries)

                return (
                  <div key={phase.phaseKey} className={`rounded-lg border ${colors.border}`}>
                    {/* Phase Header */}
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 ${colors.bg} rounded-t-lg cursor-pointer`}
                      onClick={() => toggleCollapse(phase.phaseKey)}
                    >
                      <Checkbox
                        checked={allSelected}
                        className={someSelected ? 'opacity-60' : ''}
                        onCheckedChange={(e) => {
                          e.stopPropagation?.()
                          togglePhase(phase.entries)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {isCollapsed ? (
                        <ChevronRight className={`w-4 h-4 ${colors.text}`} />
                      ) : (
                        <ChevronDown className={`w-4 h-4 ${colors.text}`} />
                      )}
                      <span className={`font-semibold text-sm ${colors.text}`}>
                        {phase.phaseName}
                      </span>
                      <span className={`text-xs ${colors.text} opacity-70 ml-auto`}>
                        {phase.totalHours} hrs &middot; {phase.entries.length} entries
                      </span>
                    </div>

                    {/* Phase Content */}
                    {!isCollapsed && (
                      <div className="p-2 space-y-2">
                        {phase.rooms.map(room => {
                          const roomAllSelected = room.entries.every(e => selectedIds.has(e.id))
                          const roomSomeSelected = room.entries.some(e => selectedIds.has(e.id)) && !roomAllSelected

                          return (
                            <div key={room.roomKey}>
                              {/* Room Header (only show if there are rooms) */}
                              {room.roomKey !== '_NO_ROOM' && (
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded mb-1">
                                  <Checkbox
                                    checked={roomAllSelected}
                                    className={roomSomeSelected ? 'opacity-60' : ''}
                                    onCheckedChange={() => toggleRoom(room.entries)}
                                  />
                                  <Home className="w-3.5 h-3.5 text-gray-500" />
                                  <span className="text-sm font-medium text-gray-700">{room.roomName}</span>
                                  <span className="text-xs text-gray-400 ml-auto">
                                    {room.totalHours} hrs
                                  </span>
                                </div>
                              )}

                              {/* Individual Entries */}
                              <div className="space-y-0.5">
                                {room.entries.map(entry => (
                                  <label
                                    key={entry.id}
                                    className="flex items-start gap-3 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={selectedIds.has(entry.id)}
                                      onCheckedChange={() => toggleEntry(entry.id)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500 text-xs">
                                          {formatDate(entry.startTime.split('T')[0])}
                                        </span>
                                        <span className="text-gray-400 text-xs">
                                          {formatTime(entry.startTime)}
                                          {entry.endTime && ` - ${formatTime(entry.endTime)}`}
                                        </span>
                                        <span className="font-medium text-gray-900 text-xs ml-auto">
                                          {roundToHalfHour(entry.duration || 0)} hrs
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                        <span>{entry.userName}</span>
                                        {entry.description && (
                                          <span className="text-gray-400 truncate">&middot; {entry.description}</span>
                                        )}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t pt-3">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-600">
              {selectedCount > 0 ? (
                <span>
                  <span className="font-semibold text-blue-600">{selectedCount}</span> entries
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
              {selectedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  onClick={handleMarkAsBilled}
                  disabled={markingBilled}
                >
                  {markingBilled ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                  )}
                  Mark as Already Billed
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
              >
                Add to Invoice ({selectedHours} hrs)
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
