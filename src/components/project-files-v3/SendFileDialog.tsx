'use client'

import { useState } from 'react'
import {
  Send,
  Loader2,
  Folder,
  X,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RecipientPicker } from './RecipientPicker'
import { DropboxFilePicker } from './DropboxFilePicker'
import { formatFileSize } from './v3-constants'
import type { V3Recipient, SendRecipient } from './v3-types'

interface SendFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  recipients: V3Recipient[]
  onSent: () => void
}

export function SendFileDialog({
  open,
  onOpenChange,
  projectId,
  recipients,
  onSent,
}: SendFileDialogProps) {
  const [mode, setMode] = useState<'pick' | 'selected'>('pick')
  const [selectedFile, setSelectedFile] = useState<{
    name: string
    path: string
    size: number | null
  } | null>(null)
  const [selectedRecipients, setSelectedRecipients] = useState<SendRecipient[]>([])
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)

  function handleFileSelect(entry: { name: string; path: string; size: number | null }) {
    setSelectedFile(entry)
    setMode('selected')
  }

  function handleToggleRecipient(recipient: SendRecipient) {
    setSelectedRecipients((prev) => {
      const exists = prev.find((s) => s.email.toLowerCase() === recipient.email.toLowerCase())
      if (exists) return prev.filter((s) => s.email.toLowerCase() !== recipient.email.toLowerCase())
      return [...prev, recipient]
    })
  }

  async function handleSend() {
    if (!selectedFile || selectedRecipients.length === 0) return
    setSending(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v3/file-sends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: selectedFile.path,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          recipients: selectedRecipients,
          subject: subject || undefined,
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        onSent()
        handleClose()
      }
    } catch (err) {
      console.error('File send failed:', err)
    } finally {
      setSending(false)
    }
  }

  function handleClose() {
    setMode('pick')
    setSelectedFile(null)
    setSelectedRecipients([])
    setSubject('')
    setNotes('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            Send File
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* File selection */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              File
            </label>
            {selectedFile ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  {selectedFile.size && (
                    <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setMode('pick')
                  }}
                  className="h-6 w-6 rounded hover:bg-gray-200 flex items-center justify-center"
                >
                  <X className="h-3 w-3 text-gray-500" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-sm gap-1.5"
                    onClick={() => setMode('pick')}
                  >
                    <Folder className="h-3.5 w-3.5" />
                    Pick from Dropbox
                  </Button>
                </div>
                {mode === 'pick' && (
                  <DropboxFilePicker
                    projectId={projectId}
                    onSelect={handleFileSelect}
                  />
                )}
              </div>
            )}
          </div>

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
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">
              Subject (optional)
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Kitchen measurements for review"
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
              placeholder="Please review the attached file..."
              className="text-sm min-h-[60px] resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Send button */}
        <div className="shrink-0 pt-3 border-t border-gray-100">
          <Button
            onClick={handleSend}
            disabled={!selectedFile || selectedRecipients.length === 0 || sending}
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
                Send File
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
