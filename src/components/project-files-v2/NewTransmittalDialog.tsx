'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import useSWR from 'swr'
import {
  Loader2,
  Mail,
  ClipboardList,
  Search,
  Check,
  X,
  Send,
  Plus,
  FileText,
  ChevronDown,
  User,
  Building2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Shared config ──────────────────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, { bgColor: string; textColor: string }> = {
  ARCHITECTURAL: { bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  ELECTRICAL: { bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  RCP: { bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  PLUMBING: { bgColor: 'bg-green-50', textColor: 'text-green-700' },
  MECHANICAL: { bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  INTERIOR_DESIGN: { bgColor: 'bg-pink-50', textColor: 'text-pink-700' },
}

const PURPOSE_OPTIONS = [
  'For Approval',
  'For Construction',
  'For Information',
  'For Review',
  'As Requested',
]

// ─── Types ──────────────────────────────────────────────────────────────────

interface Drawing {
  id: string
  drawingNumber: string
  title: string
  discipline: string
  currentRevision: number
  floor: { id: string; name: string; shortName: string } | null
}

interface Recipient {
  name: string
  email: string
  company: string | null
  type: string
}

interface DrawingItemConfig {
  drawingId: string
  purpose: string
  notes: string
}

interface NewTransmittalDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  preSelectedDrawings?: Drawing[]
}

// ─── Fetcher ────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// ─── Component ──────────────────────────────────────────────────────────────

export default function NewTransmittalDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  preSelectedDrawings,
}: NewTransmittalDialogProps) {
  // ── Data fetching ───────────────────────────────────────────────────────

  const { data: drawingsData } = useSWR<{ drawings: Drawing[] }>(
    open ? `/api/projects/${projectId}/project-files-v2/drawings?status=ACTIVE` : null,
    fetcher
  )

  const { data: recipientsData } = useSWR<{ recipients: Recipient[] }>(
    open ? `/api/projects/${projectId}/project-files-v2/recipients` : null,
    fetcher
  )

  // ── Form state ──────────────────────────────────────────────────────────

  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientCompany, setRecipientCompany] = useState('')
  const [recipientType, setRecipientType] = useState<string>('contractor')
  const [selectedDrawings, setSelectedDrawings] = useState<Set<string>>(new Set())
  const [drawingConfigs, setDrawingConfigs] = useState<Record<string, DrawingItemConfig>>({})
  const [subject, setSubject] = useState('Transmittal')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<'EMAIL' | 'MANUAL'>('EMAIL')
  const [drawingSearch, setDrawingSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false)

  // ── Derived data ────────────────────────────────────────────────────────

  const drawings = drawingsData?.drawings ?? []
  const recipients = recipientsData?.recipients ?? []

  const groupedRecipients = useMemo(() => {
    const groups: Record<string, Recipient[]> = {}
    for (const r of recipients) {
      const type = r.type || 'other'
      if (!groups[type]) groups[type] = []
      groups[type].push(r)
    }
    return groups
  }, [recipients])

  const filteredDrawings = useMemo(() => {
    if (!drawingSearch.trim()) return drawings
    const q = drawingSearch.toLowerCase()
    return drawings.filter(
      (d) =>
        d.drawingNumber.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.discipline.toLowerCase().includes(q)
    )
  }, [drawings, drawingSearch])

  // ── Initialize pre-selected drawings ────────────────────────────────────

  useEffect(() => {
    if (open && preSelectedDrawings && preSelectedDrawings.length > 0) {
      const ids = new Set(preSelectedDrawings.map((d) => d.id))
      setSelectedDrawings(ids)
      const configs: Record<string, DrawingItemConfig> = {}
      for (const d of preSelectedDrawings) {
        configs[d.id] = {
          drawingId: d.id,
          purpose: 'For Information',
          notes: '',
        }
      }
      setDrawingConfigs(configs)
    }
  }, [open, preSelectedDrawings])

  // ── Reset form on close ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      setRecipientName('')
      setRecipientEmail('')
      setRecipientCompany('')
      setRecipientType('contractor')
      setSelectedDrawings(new Set())
      setDrawingConfigs({})
      setSubject('Transmittal')
      setNotes('')
      setMethod('EMAIL')
      setDrawingSearch('')
      setIsSubmitting(false)
      setSubmitError(null)
      setShowRecipientDropdown(false)
    }
  }, [open])

  // ── Handlers ────────────────────────────────────────────────────────────

  const selectRecipient = useCallback((r: Recipient) => {
    setRecipientName(r.name)
    setRecipientEmail(r.email || '')
    setRecipientCompany(r.company || '')
    setRecipientType(r.type || 'contractor')
    setShowRecipientDropdown(false)
  }, [])

  const toggleDrawing = useCallback(
    (drawingId: string) => {
      setSelectedDrawings((prev) => {
        const next = new Set(prev)
        if (next.has(drawingId)) {
          next.delete(drawingId)
          setDrawingConfigs((configs) => {
            const updated = { ...configs }
            delete updated[drawingId]
            return updated
          })
        } else {
          next.add(drawingId)
          const drawing = drawings.find((d) => d.id === drawingId)
          if (drawing) {
            setDrawingConfigs((configs) => ({
              ...configs,
              [drawingId]: {
                drawingId,
                purpose: 'For Information',
                notes: '',
              },
            }))
          }
        }
        return next
      })
    },
    [drawings]
  )

  const updateDrawingConfig = useCallback(
    (drawingId: string, field: 'purpose' | 'notes', value: string) => {
      setDrawingConfigs((prev) => ({
        ...prev,
        [drawingId]: {
          ...prev[drawingId],
          [field]: value,
        },
      }))
    },
    []
  )

  const handleSubmit = useCallback(
    async (action: 'draft' | 'send') => {
      if (!recipientName.trim()) {
        setSubmitError('Recipient name is required.')
        return
      }
      if (selectedDrawings.size === 0) {
        setSubmitError('Select at least one drawing.')
        return
      }

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const items = Array.from(selectedDrawings).map((drawingId) => {
          const config = drawingConfigs[drawingId]
          const drawing = drawings.find((d) => d.id === drawingId)
          return {
            drawingId,
            revisionNumber: drawing?.currentRevision ?? null,
            purpose: config?.purpose || 'For Information',
            notes: config?.notes || null,
          }
        })

        const body = {
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim() || null,
          recipientCompany: recipientCompany.trim() || null,
          recipientType,
          method: method === 'MANUAL' ? 'HAND_DELIVERY' : 'EMAIL',
          subject: subject.trim() || null,
          notes: notes.trim() || null,
          items,
        }

        const createRes = await fetch(
          `/api/projects/${projectId}/project-files-v2/transmittals`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to create transmittal.')
        }

        const created = await createRes.json()

        // If "Send Now", also call the send endpoint
        if (action === 'send' && method === 'EMAIL') {
          const sendRes = await fetch(
            `/api/projects/${projectId}/project-files-v2/transmittals/${created.id}/send`,
            { method: 'POST' }
          )
          if (!sendRes.ok) {
            const err = await sendRes.json().catch(() => ({}))
            throw new Error(err.error || 'Transmittal created but failed to send.')
          }
        }

        onSuccess()
        onOpenChange(false)
      } catch (err: any) {
        setSubmitError(err.message || 'An unexpected error occurred.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      recipientName,
      recipientEmail,
      recipientCompany,
      recipientType,
      selectedDrawings,
      drawingConfigs,
      drawings,
      method,
      subject,
      notes,
      projectId,
      onSuccess,
      onOpenChange,
    ]
  )

  // ── Render ──────────────────────────────────────────────────────────────

  const recipientTypeLabel = (type: string) => {
    switch (type) {
      case 'client':
        return 'Clients'
      case 'contractor':
        return 'Contractors'
      case 'previous':
        return 'Previous Recipients'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-gray-600" />
            New Transmittal
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Create a transmittal to track document distributions.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Section 1: Recipient ─────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              Recipient
            </h3>

            {/* Recipient selector */}
            {recipients.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <span className="text-gray-500">
                    {recipientName ? recipientName : 'Select from existing recipients...'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                {showRecipientDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                    {Object.entries(groupedRecipients).map(([type, recs]) => (
                      <div key={type}>
                        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50">
                          {recipientTypeLabel(type)}
                        </div>
                        {recs.map((r, idx) => (
                          <button
                            key={`${r.email}-${idx}`}
                            type="button"
                            onClick={() => selectRecipient(r)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-900 truncate">{r.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {[r.email, r.company].filter(Boolean).join(' - ')}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manual entry fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Email</label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Company</label>
                <Input
                  value={recipientCompany}
                  onChange={(e) => setRecipientCompany(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Type</label>
                <Select value={recipientType} onValueChange={setRecipientType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Select Drawings ───────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              Select Drawings
              {selectedDrawings.size > 0 && (
                <span className="ml-1 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {selectedDrawings.size} selected
                </span>
              )}
            </h3>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={drawingSearch}
                onChange={(e) => setDrawingSearch(e.target.value)}
                placeholder="Search drawings by number, title, or discipline..."
                className="pl-9"
              />
            </div>

            {/* Drawing checklist */}
            <div className="rounded-lg border border-gray-200 max-h-[280px] overflow-y-auto divide-y divide-gray-100">
              {filteredDrawings.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  {drawings.length === 0
                    ? 'No active drawings available.'
                    : 'No drawings match your search.'}
                </div>
              ) : (
                filteredDrawings.map((drawing) => {
                  const isSelected = selectedDrawings.has(drawing.id)
                  const disc = DISCIPLINE_COLORS[drawing.discipline]
                  const config = drawingConfigs[drawing.id]

                  return (
                    <div key={drawing.id} className="group">
                      {/* Drawing row */}
                      <div
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                          isSelected ? 'bg-purple-50/40' : 'hover:bg-gray-50'
                        )}
                        onClick={() => toggleDrawing(drawing.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleDrawing(drawing.id)}
                          className="shrink-0"
                        />
                        <span className="font-mono text-xs font-bold text-gray-800 w-[90px] shrink-0">
                          {drawing.drawingNumber}
                        </span>
                        <span className="flex-1 text-sm text-gray-700 truncate min-w-0">
                          {drawing.title}
                        </span>
                        {disc && (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0',
                              disc.bgColor,
                              disc.textColor
                            )}
                          >
                            {drawing.discipline.replace('_', ' ')}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 shrink-0">
                          Rev {drawing.currentRevision}
                        </span>
                      </div>

                      {/* Per-drawing config (purpose + notes) */}
                      {isSelected && config && (
                        <div className="bg-purple-50/30 border-t border-purple-100/60 px-3 py-2.5 pl-10 flex items-start gap-3">
                          <div className="w-44 shrink-0">
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                              Purpose
                            </label>
                            <Select
                              value={config.purpose}
                              onValueChange={(val) =>
                                updateDrawingConfig(drawing.id, 'purpose', val)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PURPOSE_OPTIONS.map((p) => (
                                  <SelectItem key={p} value={p} className="text-xs">
                                    {p}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                              Notes (optional)
                            </label>
                            <Input
                              value={config.notes}
                              onChange={(e) =>
                                updateDrawingConfig(drawing.id, 'notes', e.target.value)
                              }
                              placeholder="Item notes..."
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Section 3: Details ────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Details</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Transmittal subject line"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or cover letter message..."
                rows={3}
              />
            </div>
          </div>

          {/* ── Section 4: Send Method ───────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Send Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email option */}
              <button
                type="button"
                onClick={() => setMethod('EMAIL')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  method === 'EMAIL'
                    ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    method === 'EMAIL' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Send via Email</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Send transmittal email with document list to recipient
                  </div>
                </div>
                {method === 'EMAIL' && (
                  <Check className="h-5 w-5 shrink-0 text-purple-600 ml-auto" />
                )}
              </button>

              {/* Manual option */}
              <button
                type="button"
                onClick={() => setMethod('MANUAL')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  method === 'MANUAL'
                    ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    method === 'MANUAL' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Log Manually</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Record this transmittal without sending an email
                  </div>
                </div>
                {method === 'MANUAL' && (
                  <Check className="h-5 w-5 shrink-0 text-purple-600 ml-auto" />
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <X className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50/50 px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit('draft')}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmit('send')}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : method === 'EMAIL' ? (
                <Send className="h-4 w-4 mr-1.5" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              {method === 'EMAIL' ? 'Send Now' : 'Save Record'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
