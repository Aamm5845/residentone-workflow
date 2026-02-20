'use client'

import { useState } from 'react'
import { X, Send, Loader2, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RecipientPicker } from './RecipientPicker'
import { DisciplineBadge } from './DisciplineBadge'
import { PURPOSE_OPTIONS } from './v3-constants'
import type { V3Drawing, V3Recipient, SendRecipient } from './v3-types'

interface ComposeTransmittalProps {
  drawings: V3Drawing[]
  selectedDrawingIds: Set<string>
  recipients: V3Recipient[]
  projectId: string
  onClose: () => void
  onSent: () => void
}

export function ComposeTransmittal({
  drawings,
  selectedDrawingIds,
  recipients,
  projectId,
  onClose,
  onSent,
}: ComposeTransmittalProps) {
  const selectedDrawings = drawings.filter((d) => selectedDrawingIds.has(d.id))
  const [selectedRecipients, setSelectedRecipients] = useState<SendRecipient[]>([])
  const [purposes, setPurposes] = useState<Record<string, string>>({})
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [minimized, setMinimized] = useState(false)

  function handleToggleRecipient(recipient: SendRecipient) {
    setSelectedRecipients((prev) => {
      const exists = prev.find((s) => s.email.toLowerCase() === recipient.email.toLowerCase())
      if (exists) return prev.filter((s) => s.email.toLowerCase() !== recipient.email.toLowerCase())
      return [...prev, recipient]
    })
  }

  function handlePurposeChange(drawingId: string, purpose: string) {
    setPurposes((prev) => ({ ...prev, [drawingId]: purpose }))
  }

  async function handleSend() {
    if (selectedRecipients.length === 0 || selectedDrawings.length === 0) return
    setSending(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v3/transmittals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: selectedRecipients,
          items: selectedDrawings.map((d) => ({
            drawingId: d.id,
            purpose: purposes[d.id] || 'FOR_INFORMATION',
          })),
          subject: subject || undefined,
          notes: notes || undefined,
          sendImmediately: true,
        }),
      })

      if (res.ok) {
        onSent()
        onClose()
      }
    } catch (err) {
      console.error('Compose send failed:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-0 right-6 w-[480px] z-50 bg-white rounded-t-xl border border-b-0 border-gray-200 shadow-2xl flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">
            Send {selectedDrawings.length} Drawing{selectedDrawings.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(!minimized)}
            className="h-6 w-6 rounded hover:bg-gray-100 flex items-center justify-center"
          >
            <ChevronUp className={`h-3.5 w-3.5 text-gray-500 transition-transform ${minimized ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Recipients */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                To
              </label>
              <RecipientPicker
                recipients={recipients}
                selected={selectedRecipients}
                onToggle={handleToggleRecipient}
                onAddManual={(r) => setSelectedRecipients((prev) => [...prev, r])}
                compact
              />
            </div>

            {/* Drawings list */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                Drawings ({selectedDrawings.length})
              </label>
              <div className="space-y-1.5">
                {selectedDrawings.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono font-semibold text-gray-900">
                          {d.drawingNumber}
                        </span>
                        <DisciplineBadge discipline={d.discipline} />
                        <span className="text-xs text-gray-400">Rev {d.currentRevision}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{d.title}</p>
                    </div>
                    <Select
                      value={purposes[d.id] || 'FOR_INFORMATION'}
                      onValueChange={(v) => handlePurposeChange(d.id, v)}
                    >
                      <SelectTrigger className="h-7 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSE_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value} className="text-xs">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">
                Subject (optional)
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Drawing issue for review"
                className="h-8 text-sm"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">
                Note (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Please review and confirm..."
                className="text-sm min-h-[60px] resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-3 border-t border-gray-100">
            <Button
              onClick={handleSend}
              disabled={selectedRecipients.length === 0 || sending}
              className="w-full h-9 text-sm gap-1.5"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send to {selectedRecipients.length || '...'} recipient{selectedRecipients.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
