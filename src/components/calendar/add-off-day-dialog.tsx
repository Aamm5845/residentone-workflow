'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Palmtree,
  Thermometer,
  User,
  Building,
  HelpCircle,
  Loader2,
  Umbrella,
} from 'lucide-react'

const OFF_DAY_REASONS = [
  { value: 'VACATION', label: 'Vacation', icon: Palmtree, color: 'text-green-600' },
  { value: 'SICK', label: 'Sick Day', icon: Thermometer, color: 'text-red-600' },
  { value: 'PERSONAL', label: 'Personal', icon: User, color: 'text-blue-600' },
  { value: 'HOLIDAY', label: 'Holiday', icon: Building, color: 'text-purple-600' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, color: 'text-gray-600' },
]

interface TeamMember {
  id: string
  name: string | null
  email: string
  role: string
}

interface AddOffDayDialogProps {
  defaultDate?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  currentUser: {
    id: string
    name: string
    role: string
  }
}

export function AddOffDayDialog({
  defaultDate,
  open,
  onOpenChange,
  onSuccess,
  currentUser,
}: AddOffDayDialogProps) {
  const [date, setDate] = useState(defaultDate || '')
  const [reason, setReason] = useState('VACATION')
  const [notes, setNotes] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = ['OWNER', 'ADMIN'].includes(currentUser.role)

  // Update date when defaultDate changes (opening for a new day)
  useEffect(() => {
    if (defaultDate) {
      setDate(defaultDate)
    }
  }, [defaultDate])

  // Fetch team members when dialog opens (only for admins)
  useEffect(() => {
    if (open && isAdmin && teamMembers.length === 0) {
      setLoadingTeam(true)
      fetch('/api/team')
        .then((res) => res.json())
        .then((data) => {
          if (data.members) {
            setTeamMembers(data.members)
          } else if (Array.isArray(data)) {
            setTeamMembers(data)
          }
        })
        .catch(() => {
          // Fallback: just show current user
          setTeamMembers([])
        })
        .finally(() => setLoadingTeam(false))
    }
  }, [open, isAdmin, teamMembers.length])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReason('VACATION')
      setNotes('')
      setSelectedUserId(currentUser.id)
      setError(null)
    }
  }, [open, currentUser.id])

  const handleSubmit = async () => {
    if (!date) {
      setError('Please select a date')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/timeline/off-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          reason,
          notes: notes.trim() || undefined,
          ...(isAdmin && selectedUserId !== currentUser.id ? { userId: selectedUserId } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to add off day')
        return
      }

      onOpenChange?.(false)
      onSuccess?.()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedMember = teamMembers.find((m) => m.id === selectedUserId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Umbrella className="w-5 h-5 text-amber-500" />
            Add Vacation / Off Day
          </DialogTitle>
          <DialogDescription>
            Add a day off for {isAdmin ? 'a team member' : 'yourself'}. It will appear on the calendar for everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Team Member Selector (admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="team-member">Team Member</Label>
              {loadingTeam ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading team...
                </div>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="team-member">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Current user first */}
                    <SelectItem value={currentUser.id}>
                      {currentUser.name} (You)
                    </SelectItem>
                    {/* Other team members */}
                    {teamMembers
                      .filter((m) => m.id !== currentUser.id)
                      .map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name || member.email}
                          <span className="text-xs text-gray-400 ml-1.5">
                            {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="off-day-date">Date</Label>
            <Input
              id="off-day-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="off-day-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="off-day-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFF_DAY_REASONS.map((r) => {
                  const Icon = r.icon
                  return (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${r.color}`} />
                        {r.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="off-day-notes">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="off-day-notes"
              placeholder="e.g. Doctor appointment, family trip..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !date}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Umbrella className="w-4 h-4 mr-2" />
                  Add Off Day
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
