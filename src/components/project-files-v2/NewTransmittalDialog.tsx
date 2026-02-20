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
  FileText,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  Users,
  HardHat,
  UserPlus,
  AlertTriangle,
  Clock,
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
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Shared config ──────────────────────────────────────────────────────────

const PURPOSE_OPTIONS = [
  'For Approval',
  'For Construction',
  'For Information',
  'For Review',
  'As Requested',
]

// ─── Recipient category config ──────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  textColor: string
  borderColor: string
}> = {
  CLIENT: {
    label: 'Client',
    icon: User,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  CONTRACTOR: {
    label: 'Contractors',
    icon: HardHat,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  SUBCONTRACTOR: {
    label: 'Subcontractors',
    icon: Building2,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  TEAM: {
    label: 'Team',
    icon: Users,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
  },
  OTHER: {
    label: 'Previous',
    icon: Clock,
    color: 'bg-gray-400',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
  },
}

const CATEGORY_ORDER = ['CLIENT', 'CONTRACTOR', 'SUBCONTRACTOR', 'TEAM', 'OTHER']

// ─── Types ──────────────────────────────────────────────────────────────────

interface Drawing {
  id: string
  drawingNumber: string
  title: string
  discipline: string | null
  section: { id: string; name: string; shortName: string; color: string } | null
  currentRevision: number
  floor: { id: string; name: string; shortName: string } | null
  cadSourceLink?: {
    cadFreshnessStatus: string
  } | null
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

  const { data: recipientsData } = useSWR<Recipient[]>(
    open ? `/api/projects/${projectId}/project-files-v2/recipients` : null,
    fetcher
  )

  // ── Form state ──────────────────────────────────────────────────────────

  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientCompany, setRecipientCompany] = useState('')
  const [recipientType, setRecipientType] = useState<string>('CONTRACTOR')
  const [selectedDrawings, setSelectedDrawings] = useState<Set<string>>(new Set())
  const [drawingConfigs, setDrawingConfigs] = useState<Record<string, DrawingItemConfig>>({})
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<'EMAIL' | 'MANUAL'>('EMAIL')
  const [drawingSearch, setDrawingSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // ── Derived data ──────────────────────────────────────────────────────

  const drawings = drawingsData?.drawings ?? []
  const recipients = recipientsData ?? []

  const groupedRecipients = useMemo(() => {
    const groups: Record<string, Recipient[]> = {}
    for (const r of recipients) {
      const type = r.type || 'OTHER'
      if (!groups[type]) groups[type] = []
      groups[type].push(r)
    }
    return groups
  }, [recipients])

  const orderedGroups = useMemo(() => {
    const result: { type: string; recipients: Recipient[] }[] = []
    for (const type of CATEGORY_ORDER) {
      if (groupedRecipients[type]?.length) {
        result.push({ type, recipients: groupedRecipients[type] })
      }
    }
    for (const [type, recs] of Object.entries(groupedRecipients)) {
      if (!CATEGORY_ORDER.includes(type) && recs.length > 0) {
        result.push({ type, recipients: recs })
      }
    }
    return result
  }, [groupedRecipients])

  const filteredDrawings = useMemo(() => {
    if (!drawingSearch.trim()) return drawings
    const q = drawingSearch.toLowerCase()
    return drawings.filter(
      (d) =>
        d.drawingNumber.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        (d.section?.name && d.section.name.toLowerCase().includes(q))
    )
  }, [drawings, drawingSearch])

  const hasRecipient = recipientName.trim().length > 0

  // Is this recipient from the list?
  const selectedRecipientKey = recipientEmail
    ? `${recipientName}|${recipientEmail}`
    : ''

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
      setRecipientType('CONTRACTOR')
      setSelectedDrawings(new Set())
      setDrawingConfigs({})
      setSubject('')
      setNotes('')
      setMethod('EMAIL')
      setDrawingSearch('')
      setIsSubmitting(false)
      setSubmitError(null)
      setShowManualEntry(false)
      setExpandedCategory(null)
    }
  }, [open])

  // ── Handlers ────────────────────────────────────────────────────────────

  const selectRecipient = useCallback((r: Recipient) => {
    setRecipientName(r.name)
    setRecipientEmail(r.email || '')
    setRecipientCompany(r.company || '')
    setRecipientType(r.type?.toUpperCase() || 'CONTRACTOR')
    setShowManualEntry(false)
  }, [])

  const clearRecipient = useCallback(() => {
    setRecipientName('')
    setRecipientEmail('')
    setRecipientCompany('')
    setRecipientType('CONTRACTOR')
    setShowManualEntry(false)
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
        setSubmitError('Please select or enter a recipient.')
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
          throw new Error(err.error || 'Failed to create record.')
        }

        const created = await createRes.json()

        if (action === 'send' && method === 'EMAIL') {
          const sendRes = await fetch(
            `/api/projects/${projectId}/project-files-v2/transmittals/${created.id}/send`,
            { method: 'POST' }
          )
          if (!sendRes.ok) {
            const err = await sendRes.json().catch(() => ({}))
            throw new Error(err.error || 'Created but failed to send email.')
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

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-gray-600" />
            Send Drawings
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Select a recipient and choose drawings to send.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Section 1: Recipient ─────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              Send To
            </h3>

            {/* Selected recipient card */}
            {hasRecipient ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-purple-200 bg-purple-50/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{recipientName}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {[recipientEmail, recipientCompany].filter(Boolean).join(' \u00b7 ')}
                  </div>
                </div>
                <Check className="h-4 w-4 text-purple-600 shrink-0" />
                <button
                  type="button"
                  onClick={clearRecipient}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-purple-100 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : !showManualEntry ? (
              /* ── Category tabs + contact list ── */
              <div className="space-y-2">
                {orderedGroups.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400">
                    No contacts found for this project.
                  </div>
                ) : (
                  <>
                    {/* Category pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {orderedGroups.map(({ type, recipients: recs }) => {
                        const config = CATEGORY_CONFIG[type] || CATEGORY_CONFIG.OTHER
                        const Icon = config.icon
                        const isActive = expandedCategory === type

                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setExpandedCategory(isActive ? null : type)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                              isActive
                                ? cn(config.bgColor, config.textColor, 'ring-1', config.borderColor)
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {config.label}
                            <span className={cn(
                              'inline-flex items-center justify-center h-4 min-w-[16px] rounded-full px-1 text-[10px] font-bold',
                              isActive ? 'bg-white/60' : 'bg-gray-200/80'
                            )}>
                              {recs.length}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Contact list for selected category */}
                    {expandedCategory && groupedRecipients[expandedCategory] && (
                      <div className="rounded-lg border border-gray-200 divide-y divide-gray-50 max-h-[180px] overflow-y-auto">
                        {groupedRecipients[expandedCategory].map((r, idx) => (
                          <button
                            key={`${r.email}-${idx}`}
                            type="button"
                            onClick={() => selectRecipient(r)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                              <div className="text-xs text-gray-400 truncate">
                                {[r.email, r.company].filter(Boolean).join(' \u00b7 ')}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Manual entry button */}
                <button
                  type="button"
                  onClick={() => { setShowManualEntry(true); setExpandedCategory(null) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Enter manually
                </button>
              </div>
            ) : (
              /* Manual entry form */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Enter recipient details</span>
                  {recipients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(false)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Back to contacts
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Recipient name"
                      autoFocus
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
                        <SelectItem value="CLIENT">Client</SelectItem>
                        <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                        <SelectItem value="SUBCONTRACTOR">Subcontractor</SelectItem>
                        <SelectItem value="CONSULTANT">Consultant</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
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
                placeholder="Search drawings..."
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
                  const section = drawing.section
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
                        {section && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 shrink-0">
                            <span className={cn('h-1.5 w-1.5 rounded-full', section.color || 'bg-gray-400')} />
                            {section.shortName}
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
                placeholder="e.g. Updated floor plans, Revision 3..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or message..."
                rows={2}
              />
            </div>
          </div>

          {/* ── Section 4: Send Method ───────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Method</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMethod('EMAIL')}
                className={cn(
                  'flex-1 flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-all',
                  method === 'EMAIL'
                    ? 'border-purple-500 bg-purple-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Mail className={cn('h-4 w-4', method === 'EMAIL' ? 'text-purple-600' : 'text-gray-400')} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Email</div>
                  <div className="text-[11px] text-gray-500">Send with PDF attached</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMethod('MANUAL')}
                className={cn(
                  'flex-1 flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-all',
                  method === 'MANUAL'
                    ? 'border-purple-500 bg-purple-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <ClipboardList className={cn('h-4 w-4', method === 'MANUAL' ? 'text-purple-600' : 'text-gray-400')} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Log Only</div>
                  <div className="text-[11px] text-gray-500">Record without email</div>
                </div>
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

          {/* Stale CAD warning */}
          {(() => {
            const staleDrawings = drawings.filter(
              (d) =>
                selectedDrawings.has(d.id) &&
                d.cadSourceLink &&
                (d.cadSourceLink.cadFreshnessStatus === 'CAD_MODIFIED' ||
                  d.cadSourceLink.cadFreshnessStatus === 'NEEDS_REPLOT')
            )
            if (staleDrawings.length === 0) return null
            return (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-medium">Some drawings may have outdated PDFs:</p>
                  <ul className="mt-1 space-y-0.5">
                    {staleDrawings.map((d) => (
                      <li key={d.id} className="text-xs text-amber-700">
                        {d.drawingNumber} &mdash; {d.title}
                        {d.cadSourceLink?.cadFreshnessStatus === 'NEEDS_REPLOT' && (
                          <span className="ml-1 text-red-600 font-medium">(needs re-plot)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })()}
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
