'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  MapPin,
  Link2,
  Users,
  Building2,
  HardHat,
  UserPlus,
  Bell,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  Video,
  CheckCircle2,
  XCircle,
  CircleDashed,
} from 'lucide-react'

interface MeetingAttendee {
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
}

interface MeetingDetail {
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
  attendees: MeetingAttendee[]
}

interface MeetingDetailDialogProps {
  meeting: MeetingDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (meeting: MeetingDetail) => void
  onRefresh?: () => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getLocationLabel(type: string): string {
  switch (type) {
    case 'VIRTUAL': return 'Virtual Meeting'
    case 'IN_OFFICE': return 'In Office'
    case 'ON_SITE': return 'On Site'
    default: return type
  }
}

function getLocationIcon(type: string) {
  switch (type) {
    case 'VIRTUAL': return <Video className="h-4 w-4 text-cyan-400" />
    case 'IN_OFFICE': return <Building2 className="h-4 w-4 text-blue-400" />
    case 'ON_SITE': return <MapPin className="h-4 w-4 text-green-400" />
    default: return <MapPin className="h-4 w-4" />
  }
}

function getAttendeeInfo(att: MeetingAttendee) {
  if (att.user) return { name: att.user.name || att.user.email, email: att.user.email, type: 'Team' }
  if (att.client) return { name: att.client.name, email: att.client.email, type: 'Client' }
  if (att.contractor) return {
    name: att.contractor.contactName || att.contractor.businessName,
    email: att.contractor.email,
    type: att.contractor.type === 'SUBCONTRACTOR' ? 'Sub' : 'Contractor',
  }
  return { name: att.externalName || 'External', email: att.externalEmail || '', type: 'External' }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'TEAM_MEMBER': return <Users className="h-3.5 w-3.5 text-blue-400" />
    case 'CLIENT': return <Building2 className="h-3.5 w-3.5 text-green-400" />
    case 'CONTRACTOR':
    case 'SUBCONTRACTOR': return <HardHat className="h-3.5 w-3.5 text-orange-400" />
    default: return <UserPlus className="h-3.5 w-3.5 text-gray-400" />
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return (
        <Badge variant="outline" className="text-[10px] py-0 border-green-300 text-green-600 bg-green-50 gap-0.5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Confirmed
        </Badge>
      )
    case 'DECLINED':
      return (
        <Badge variant="outline" className="text-[10px] py-0 border-red-300 text-red-600 bg-red-50 gap-0.5">
          <XCircle className="h-2.5 w-2.5" />
          Declined
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px] py-0 border-amber-300 text-amber-600 bg-amber-50 gap-0.5">
          <CircleDashed className="h-2.5 w-2.5" />
          Pending
        </Badge>
      )
  }
}

export function MeetingDetailDialog({ meeting, open, onOpenChange, onEdit, onRefresh }: MeetingDetailDialogProps) {
  const [isSendingReminder, setIsSendingReminder] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (!meeting) return null

  const handleSendReminder = async () => {
    setIsSendingReminder(true)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/remind`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Reminder sent to ${data.sentCount} attendee(s)`)
      }
    } catch (err) {
      console.error('Failed to send reminder:', err)
    }
    setIsSendingReminder(false)
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      if (res.ok) {
        onOpenChange(false)
        onRefresh?.()
      }
    } catch (err) {
      console.error('Failed to cancel meeting:', err)
    }
    setIsCancelling(false)
    setShowCancelConfirm(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{meeting.title}</DialogTitle>
          <DialogDescription>
            {getLocationLabel(meeting.locationType)} · {formatDate(meeting.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{formatDate(meeting.date)}</div>
              <div className="text-sm text-muted-foreground">
                {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            {getLocationIcon(meeting.locationType)}
            <div>
              <div className="text-sm font-medium">{getLocationLabel(meeting.locationType)}</div>
              {meeting.locationDetails && (
                <div className="text-sm text-muted-foreground">{meeting.locationDetails}</div>
              )}
            </div>
          </div>

          {/* Meeting Link */}
          {meeting.meetingLink && (
            <div className="flex items-start gap-3">
              <Link2 className="h-4 w-4 mt-0.5 text-cyan-400" />
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Join Meeting
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Project */}
          {meeting.project && (
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <span className="text-muted-foreground">Project:</span>{' '}
                <span className="font-medium">{meeting.project.name}</span>
              </div>
            </div>
          )}

          {/* Organizer */}
          {meeting.organizer && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <span className="text-muted-foreground">Organized by:</span>{' '}
                <span className="font-medium">{meeting.organizer.name || meeting.organizer.email}</span>
              </div>
            </div>
          )}

          {/* Description */}
          {meeting.description && (
            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{meeting.description}</p>
            </div>
          )}

          {/* Attendees */}
          {meeting.attendees.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Attendees ({meeting.attendees.length})
                </div>
                {meeting.attendees.some(a => a.status === 'ACCEPTED' || a.status === 'DECLINED') && (
                  <div className="text-[10px] text-muted-foreground">
                    {meeting.attendees.filter(a => a.status === 'ACCEPTED').length} confirmed
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {meeting.attendees.map((att) => {
                  const info = getAttendeeInfo(att)
                  return (
                    <div key={att.id} className="flex items-center gap-2 text-sm">
                      {getTypeIcon(att.type)}
                      <span className="flex-1 truncate">{info.name}</span>
                      {getStatusBadge(att.status)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false)
                  onEdit(meeting)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleSendReminder}
              disabled={isSendingReminder}
            >
              {isSendingReminder ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              Send Reminder
            </Button>

            {!showCancelConfirm ? (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5 ml-auto"
                onClick={() => setShowCancelConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Cancel Meeting
              </Button>
            ) : (
              <div className="flex gap-1.5 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  No
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Yes, Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
