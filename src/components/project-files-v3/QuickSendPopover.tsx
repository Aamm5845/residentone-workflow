'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { RecipientPicker } from './RecipientPicker'
import type { V3Recipient, V3Drawing, SendRecipient } from './v3-types'

interface QuickSendPopoverProps {
  drawing: V3Drawing
  recipients: V3Recipient[]
  projectId: string
  onSent: () => void
  children: React.ReactNode
}

export function QuickSendPopover({
  drawing,
  recipients,
  projectId,
  onSent,
  children,
}: QuickSendPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SendRecipient[]>([])
  const [sending, setSending] = useState(false)

  function handleToggle(recipient: SendRecipient) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.email.toLowerCase() === recipient.email.toLowerCase())
      if (exists) return prev.filter((s) => s.email.toLowerCase() !== recipient.email.toLowerCase())
      return [...prev, recipient]
    })
  }

  function handleAddManual(recipient: SendRecipient) {
    setSelected((prev) => [...prev, recipient])
  }

  async function handleSend() {
    if (selected.length === 0) return
    setSending(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v3/transmittals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: selected,
          items: [{ drawingId: drawing.id, purpose: 'FOR_INFORMATION' }],
          sendImmediately: true,
        }),
      })

      if (res.ok) {
        setOpen(false)
        setSelected([])
        onSent()
      }
    } catch (err) {
      console.error('Quick send failed:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end" sideOffset={4}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-900">
                Send {drawing.drawingNumber}
              </p>
              <p className="text-[10px] text-gray-500">Rev {drawing.currentRevision}</p>
            </div>
          </div>

          <RecipientPicker
            recipients={recipients}
            selected={selected}
            onToggle={handleToggle}
            onAddManual={handleAddManual}
            compact
          />

          <Button
            onClick={handleSend}
            disabled={selected.length === 0 || sending}
            className="w-full h-8 text-xs"
            size="sm"
          >
            {sending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3 w-3 mr-1.5" />
                Send to {selected.length || '...'} recipient{selected.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
