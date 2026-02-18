'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Checkbox } from '@/components/ui/checkbox'
import { CalendarPlus, Loader2, Video, MapPin } from 'lucide-react'
import { AttendeeCombobox, type SelectedAttendee } from './attendee-combobox'

// Generate time options in 15-minute increments (7:00 AM to 10:00 PM)
const timeOptions = (() => {
  const options: { value: string; label: string }[] = []
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour24 = String(h).padStart(2, '0')
      const min = String(m).padStart(2, '0')
      const value = `${hour24}:${min}`
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
      const ampm = h >= 12 ? 'PM' : 'AM'
      const label = `${hour12}:${min} ${ampm}`
      options.push({ value, label })
    }
  }
  return options
})()

const meetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional(),
  locationType: z.enum(['VIRTUAL', 'IN_OFFICE', 'ON_SITE']),
  locationDetails: z.string().optional(),
  meetingLink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  projectId: z.string().optional(),
  reminderMinutes: z.number().default(30),
})

type MeetingFormData = z.infer<typeof meetingSchema>

interface Project {
  id: string
  name: string
  streetAddress?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
}

interface MeetingData {
  id: string
  title: string
  description?: string | null
  date: string
  startTime: string
  endTime: string
  locationType: string
  locationDetails?: string | null
  meetingLink?: string | null
  projectId?: string | null
  reminderMinutes: number
  attendees: Array<{
    type: string
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

interface ScheduleMeetingDialogProps {
  projects: Project[]
  editMeeting?: MeetingData | null
  trigger?: React.ReactNode
  onSuccess?: () => void
  defaultDate?: string | null  // YYYY-MM-DD format to pre-fill the date
  open?: boolean               // Controlled open state
  onOpenChange?: (open: boolean) => void  // Controlled open change
}

export function ScheduleMeetingDialog({ projects, editMeeting, trigger, onSuccess, defaultDate, open: controlledOpen, onOpenChange: controlledOnOpenChange }: ScheduleMeetingDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attendees, setAttendees] = useState<SelectedAttendee[]>([])
  const [sendInvitations, setSendInvitations] = useState(true)
  const [error, setError] = useState('')
  const [zoomConnected, setZoomConnected] = useState(false)
  const [autoCreateZoom, setAutoCreateZoom] = useState(true)
  const [useManualAddress, setUseManualAddress] = useState(false)

  const isEditing = !!editMeeting

  // Check if org has Zoom connected
  useEffect(() => {
    fetch('/api/integrations/zoom/status')
      .then((res) => res.json())
      .then((data) => setZoomConnected(data.connected === true))
      .catch(() => {}) // Silently fail — manual link pasting still works
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      locationType: 'VIRTUAL',
      locationDetails: '',
      meetingLink: '',
      projectId: '',
      reminderMinutes: 30,
    },
  })

  const locationType = watch('locationType')
  const selectedProjectId = watch('projectId')

  // Build full address string from project fields
  const getProjectAddress = (project: Project): string => {
    const parts = [project.streetAddress, project.city, project.province, project.postalCode].filter(Boolean)
    return parts.join(', ')
  }

  // Auto-fill project address when ON_SITE is selected and a project is chosen
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const projectAddress = selectedProject ? getProjectAddress(selectedProject) : ''

  useEffect(() => {
    if (locationType === 'ON_SITE' && selectedProjectId && !useManualAddress && !isEditing) {
      if (projectAddress) {
        setValue('locationDetails', projectAddress)
      }
    }
  }, [locationType, selectedProjectId, useManualAddress, projectAddress, setValue, isEditing])

  // Reset manual address toggle when switching location type or project
  useEffect(() => {
    setUseManualAddress(false)
  }, [locationType, selectedProjectId])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setError('')
      if (editMeeting) {
        // Populate form for editing
        const meetDate = new Date(editMeeting.date)
        const meetStart = new Date(editMeeting.startTime)
        const meetEnd = new Date(editMeeting.endTime)

        reset({
          title: editMeeting.title,
          description: editMeeting.description || '',
          date: meetDate.toISOString().split('T')[0],
          startTime: meetStart.toTimeString().slice(0, 5),
          endTime: meetEnd.toTimeString().slice(0, 5),
          locationType: editMeeting.locationType as 'VIRTUAL' | 'IN_OFFICE' | 'ON_SITE',
          locationDetails: editMeeting.locationDetails || '',
          meetingLink: editMeeting.meetingLink || '',
          projectId: editMeeting.projectId || '',
          reminderMinutes: editMeeting.reminderMinutes || 30,
        })

        // Populate attendees
        const existingAttendees: SelectedAttendee[] = editMeeting.attendees.map((att) => {
          if (att.user) {
            return {
              type: 'TEAM_MEMBER' as const,
              userId: att.user.id,
              displayName: att.user.name || att.user.email,
              displayEmail: att.user.email,
            }
          }
          if (att.client) {
            return {
              type: 'CLIENT' as const,
              clientId: att.client.id,
              displayName: att.client.name,
              displayEmail: att.client.email,
            }
          }
          if (att.contractor) {
            return {
              type: (att.contractor.type === 'SUBCONTRACTOR' ? 'SUBCONTRACTOR' : 'CONTRACTOR') as 'CONTRACTOR' | 'SUBCONTRACTOR',
              contractorId: att.contractor.id,
              displayName: att.contractor.contactName || att.contractor.businessName,
              displayEmail: att.contractor.email,
            }
          }
          return {
            type: 'EXTERNAL' as const,
            externalName: att.externalName || '',
            externalEmail: att.externalEmail || '',
            displayName: att.externalName || 'External',
            displayEmail: att.externalEmail || '',
          }
        })
        setAttendees(existingAttendees)
      } else {
        reset({
          title: '',
          description: '',
          date: defaultDate || '',
          startTime: '',
          endTime: '',
          locationType: 'VIRTUAL',
          locationDetails: '',
          meetingLink: '',
          projectId: '',
          reminderMinutes: 30,
        })
        setAttendees([])
      }
    }
  }

  const onSubmit = async (data: MeetingFormData) => {
    setIsSubmitting(true)
    setError('')

    try {
      // Build full datetime from date + time
      const startDateTime = new Date(`${data.date}T${data.startTime}:00`)

      // Default end time to 1 hour after start if not provided
      let endDateTime: Date
      if (data.endTime) {
        endDateTime = new Date(`${data.date}T${data.endTime}:00`)
        if (endDateTime <= startDateTime) {
          setError('End time must be after start time')
          setIsSubmitting(false)
          return
        }
      } else {
        endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)
      }

      const payload = {
        title: data.title,
        description: data.description || null,
        date: startDateTime.toISOString(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        locationType: data.locationType,
        locationDetails: data.locationDetails || null,
        meetingLink: data.meetingLink || null,
        projectId: data.projectId || null,
        reminderMinutes: data.reminderMinutes,
        sendInvitations,
        sendUpdateEmails: sendInvitations,
        autoCreateZoom: !isEditing && locationType === 'VIRTUAL' && zoomConnected && autoCreateZoom,
        attendees: attendees.map((att) => ({
          type: att.type,
          userId: att.userId || null,
          clientId: att.clientId || null,
          contractorId: att.contractorId || null,
          externalName: att.externalName || null,
          externalEmail: att.externalEmail || null,
        })),
      }

      const url = isEditing ? `/api/meetings/${editMeeting!.id}` : '/api/meetings'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save meeting')
      }

      setOpen(false)
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            Schedule Meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update meeting details and attendees.' : 'Set up a new meeting with your team, clients, or contractors.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title">Title *</Label>
            <Input
              id="meeting-title"
              placeholder="e.g. Project Kickoff Meeting"
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Date & Time row */}
          {/* If date is pre-filled from calendar, show it as a label with option to change */}
          {defaultDate && watch('date') === defaultDate && !isEditing ? (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <div className="flex items-center justify-between p-2.5 bg-muted/50 border rounded-md">
                <span className="text-sm font-medium">
                  {new Date(defaultDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => setValue('date', '')}
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="meeting-date">Date *</Label>
              <Input
                id="meeting-date"
                type="date"
                {...register('date')}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start *</Label>
              <Select
                value={watch('startTime') || ''}
                onValueChange={(val) => setValue('startTime', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {timeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">End <span className="text-xs font-normal">(optional)</span></Label>
              <Select
                value={watch('endTime') || ''}
                onValueChange={(val) => setValue('endTime', val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="+ 1 hour" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="none">Default (1 hour)</SelectItem>
                  {timeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location Type */}
          <div className="space-y-1.5">
            <Label>Location Type *</Label>
            <Select
              value={locationType}
              onValueChange={(val) => setValue('locationType', val as 'VIRTUAL' | 'IN_OFFICE' | 'ON_SITE')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIRTUAL">Virtual</SelectItem>
                <SelectItem value="IN_OFFICE">In Office</SelectItem>
                <SelectItem value="ON_SITE">On Site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location Details */}
          {(locationType === 'IN_OFFICE' || locationType === 'ON_SITE') && (
            <div className="space-y-1.5">
              <Label htmlFor="meeting-location">
                {locationType === 'IN_OFFICE' ? 'Room / Office' : 'Site Address'}
              </Label>

              {/* Show project address auto-fill for ON_SITE when a project with an address is selected */}
              {locationType === 'ON_SITE' && projectAddress && !useManualAddress ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-900">{projectAddress}</p>
                      <p className="text-xs text-green-600 mt-0.5">From project information</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    onClick={() => {
                      setUseManualAddress(true)
                      setValue('locationDetails', '')
                    }}
                  >
                    Use a different address
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="meeting-location"
                    placeholder={locationType === 'IN_OFFICE' ? 'e.g. Conference Room A' : 'e.g. 123 Main St, Suite 100'}
                    {...register('locationDetails')}
                  />
                  {locationType === 'ON_SITE' && projectAddress && useManualAddress && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                      onClick={() => {
                        setUseManualAddress(false)
                        setValue('locationDetails', projectAddress)
                      }}
                    >
                      Use project address
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Auto-create Zoom meeting option */}
          {locationType === 'VIRTUAL' && zoomConnected && !isEditing && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Checkbox
                id="auto-zoom"
                checked={autoCreateZoom}
                onCheckedChange={(checked) => setAutoCreateZoom(!!checked)}
              />
              <Label htmlFor="auto-zoom" className="text-sm font-normal cursor-pointer text-blue-800 flex-1">
                Auto-create Zoom meeting
              </Label>
              <Video className="w-4 h-4 text-blue-500" />
            </div>
          )}

          {/* Meeting Link (show when not auto-creating, or for editing, or non-virtual) */}
          {(!zoomConnected || !autoCreateZoom || locationType !== 'VIRTUAL' || isEditing) && (
            <div className="space-y-1.5">
              <Label htmlFor="meeting-link">Meeting Link (Zoom / Google Meet)</Label>
              <Input
                id="meeting-link"
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                {...register('meetingLink')}
              />
              {errors.meetingLink && <p className="text-xs text-destructive">{errors.meetingLink.message}</p>}
            </div>
          )}

          {/* Project (optional) */}
          <div className="space-y-1.5">
            <Label>Project (optional)</Label>
            <Select
              value={watch('projectId') || ''}
              onValueChange={(val) => setValue('projectId', val === 'none' ? '' : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Attendees */}
          <div className="space-y-1.5">
            <Label>Attendees</Label>
            <AttendeeCombobox selected={attendees} onChange={setAttendees} projectId={selectedProjectId || undefined} />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-desc">Description (optional)</Label>
            <Textarea
              id="meeting-desc"
              placeholder="Meeting agenda, notes..."
              rows={3}
              {...register('description')}
            />
          </div>

          {/* Reminder */}
          <div className="space-y-1.5">
            <Label>Reminder</Label>
            <Select
              value={String(watch('reminderMinutes'))}
              onValueChange={(val) => setValue('reminderMinutes', parseInt(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="1440">1 day before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Send Invitations */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="send-invites"
              checked={sendInvitations}
              onCheckedChange={(checked) => setSendInvitations(!!checked)}
            />
            <Label htmlFor="send-invites" className="text-sm font-normal cursor-pointer">
              Send email {isEditing ? 'update' : 'invitation'}s to attendees
            </Label>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEditing ? 'Update Meeting' : 'Schedule Meeting'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
