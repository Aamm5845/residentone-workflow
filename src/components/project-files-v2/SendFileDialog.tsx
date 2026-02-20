'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import useSWR from 'swr'
import {
  Loader2,
  Upload,
  X,
  Send,
  FileText,
  Folder,
  ChevronRight,
  ArrowLeft,
  Paperclip,
  User,
  Building2,
  Users,
  HardHat,
  Clock,
  UserPlus,
  Check,
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
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttachedFile {
  name: string
  size: number
  source: 'upload' | 'dropbox'
  // For uploads: base64 content
  base64?: string
  // For dropbox: relative path
  dropboxPath?: string
}

interface Recipient {
  name: string
  email: string
  company: string | null
  type: string
}

interface SendFileDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  textColor: string
}> = {
  CLIENT: { label: 'Client', icon: User, color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  CONTRACTOR: { label: 'Contractors', icon: HardHat, color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  SUBCONTRACTOR: { label: 'Subs', icon: Building2, color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  TEAM: { label: 'Team', icon: Users, color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  OTHER: { label: 'Previous', icon: Clock, color: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
}
const CATEGORY_ORDER = ['CLIENT', 'CONTRACTOR', 'SUBCONTRACTOR', 'TEAM', 'OTHER']

const fetcher = (url: string) => fetch(url).then(r => r.json())

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SendFileDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: SendFileDialogProps) {
  // ── File state ──
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [showDropboxPicker, setShowDropboxPicker] = useState(false)
  const [dropboxPath, setDropboxPath] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Recipient state ──
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // ── Form state ──
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Data ──
  const { data: recipientsData } = useSWR<Recipient[]>(
    open ? `/api/projects/${projectId}/project-files-v2/recipients` : null,
    fetcher
  )
  const { data: browseData, isLoading: browsing } = useSWR(
    open && showDropboxPicker
      ? `/api/projects/${projectId}/project-files-v2/browse?path=${encodeURIComponent(dropboxPath)}`
      : null,
    fetcher
  )

  const recipients = recipientsData ?? []
  const groupedRecipients = useMemo(() => {
    const groups: Record<string, Recipient[]> = {}
    for (const r of recipients) {
      const cat = r.type?.toUpperCase() || 'OTHER'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(r)
    }
    return groups
  }, [recipients])

  const hasRecipient = recipientName.trim().length > 0 && recipientEmail.trim().length > 0
  const canSend = files.length > 0 && hasRecipient && !isSubmitting

  // ── Reset ──
  const reset = useCallback(() => {
    setFiles([])
    setShowDropboxPicker(false)
    setDropboxPath('')
    setRecipientName('')
    setRecipientEmail('')
    setShowManualEntry(false)
    setExpandedCategory(null)
    setSubject('')
    setNotes('')
    setIsSubmitting(false)
    setSubmitError(null)
    setIsDragging(false)
  }, [])

  // ── File handlers ──
  const handleFileUpload = useCallback(async (fileList: FileList) => {
    const newFiles: AttachedFile[] = []
    for (const file of Array.from(fileList)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      newFiles.push({
        name: file.name,
        size: file.size,
        source: 'upload',
        base64,
      })
    }
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const addDropboxFile = useCallback((file: { name: string; path: string; size: number }) => {
    setFiles(prev => [...prev, {
      name: file.name,
      size: file.size,
      source: 'dropbox',
      dropboxPath: file.path,
    }])
    setShowDropboxPicker(false)
    setDropboxPath('')
  }, [])

  const selectRecipient = useCallback((r: Recipient) => {
    setRecipientName(r.name)
    setRecipientEmail(r.email)
    setExpandedCategory(null)
  }, [])

  // ── Submit ──
  const handleSend = useCallback(async () => {
    if (!canSend) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v2/send-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          subject: subject.trim() || null,
          notes: notes.trim() || null,
          files: files.map(f => ({
            name: f.name,
            size: f.size,
            source: f.source,
            base64: f.base64 || null,
            dropboxPath: f.dropboxPath || null,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }

      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }, [canSend, projectId, recipientName, recipientEmail, subject, notes, files, reset, onOpenChange, onSuccess])

  // ── Dropbox browser ──
  const folders = browseData?.folders ?? []
  const browseFiles = (browseData?.files ?? []).filter((f: any) => !f.isFolder)
  const pathParts = dropboxPath ? dropboxPath.split('/') : []

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-gray-500" />
            Send Files
          </DialogTitle>
          <DialogDescription>Attach files and send them by email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* ── FILES SECTION ── */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Files</label>

            {/* Attached files list */}
            {files.length > 0 && (
              <div className="space-y-2 mb-3">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(f.size)} · {f.source === 'dropbox' ? 'From Dropbox' : 'Uploaded'}
                      </p>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Dropbox Picker */}
            {showDropboxPicker ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm">
                  <button
                    onClick={() => setDropboxPath('')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Project Root
                  </button>
                  {pathParts.map((part, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <button
                        onClick={() => setDropboxPath(pathParts.slice(0, i + 1).join('/'))}
                        className={cn(
                          i === pathParts.length - 1
                            ? 'text-gray-900 font-medium'
                            : 'text-blue-600 hover:underline'
                        )}
                      >
                        {part}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Content */}
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {browsing ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      {/* Back button */}
                      {dropboxPath && (
                        <button
                          onClick={() => {
                            const parts = dropboxPath.split('/')
                            parts.pop()
                            setDropboxPath(parts.join('/'))
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                      )}

                      {/* Folders */}
                      {folders.map((folder: any) => (
                        <button
                          key={folder.path}
                          onClick={() => setDropboxPath(folder.path)}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors"
                        >
                          <Folder className="w-4 h-4 text-blue-500" />
                          <span className="text-gray-900 truncate">{folder.name}</span>
                        </button>
                      ))}

                      {/* Files */}
                      {browseFiles.map((file: any) => {
                        const alreadyAdded = files.some(f => f.dropboxPath === file.path)
                        return (
                          <button
                            key={file.path}
                            onClick={() => !alreadyAdded && addDropboxFile(file)}
                            disabled={alreadyAdded}
                            className={cn(
                              'flex items-center gap-2 w-full px-3 py-2.5 text-sm transition-colors',
                              alreadyAdded ? 'opacity-50 bg-green-50' : 'hover:bg-green-50'
                            )}
                          >
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900 truncate flex-1 text-left">{file.name}</span>
                            {alreadyAdded ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                            )}
                          </button>
                        )
                      })}

                      {folders.length === 0 && browseFiles.length === 0 && !browsing && (
                        <div className="py-6 text-center text-sm text-gray-500">
                          This folder is empty
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Close picker */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                  <Button variant="ghost" size="sm" onClick={() => { setShowDropboxPicker(false); setDropboxPath('') }}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              /* Drop zone + buttons */
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-3">
                  Drag & drop files here
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                    Browse Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDropboxPicker(true)}
                  >
                    <Folder className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    From Dropbox
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFileUpload(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
            )}
          </div>

          {/* ── RECIPIENT SECTION ── */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Recipient</label>

            {/* Selected recipient preview */}
            {hasRecipient && !showManualEntry ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{recipientName}</p>
                  <p className="text-xs text-gray-500">{recipientEmail}</p>
                </div>
                <button
                  onClick={() => { setRecipientName(''); setRecipientEmail('') }}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : showManualEntry ? (
              /* Manual entry */
              <div className="space-y-2">
                <Input
                  placeholder="Name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="h-9 text-sm"
                />
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ← Choose from contacts
                </button>
              </div>
            ) : (
              /* Contact picker */
              <div className="space-y-2">
                {/* Category pills */}
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ORDER.map(cat => {
                    const cfg = CATEGORY_CONFIG[cat]
                    const group = groupedRecipients[cat]
                    if (!group || group.length === 0) return null
                    const Icon = cfg.icon
                    const isExpanded = expandedCategory === cat
                    return (
                      <button
                        key={cat}
                        onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          isExpanded ? `${cfg.bgColor} ${cfg.textColor} ring-1 ring-inset ring-current/20` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                        <span className="opacity-60">({group.length})</span>
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setShowManualEntry(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <UserPlus className="w-3 h-3" />
                    Manual
                  </button>
                </div>

                {/* Expanded list */}
                {expandedCategory && groupedRecipients[expandedCategory] && (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {groupedRecipients[expandedCategory].map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectRecipient(r)}
                        className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 truncate">{r.email}{r.company ? ` · ${r.company}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {recipients.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No contacts found.{' '}
                    <button onClick={() => setShowManualEntry(true)} className="text-blue-600 hover:underline">
                      Enter manually
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── SUBJECT ── */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input
              placeholder="e.g. Updated floor plans"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* ── NOTES ── */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <Textarea
              placeholder="Any notes for the recipient..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm resize-none"
              rows={2}
            />
          </div>

          {/* ── ERROR ── */}
          {submitError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
              {submitError}
            </div>
          )}

          {/* ── ACTIONS ── */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
              {files.length} file{files.length !== 1 ? 's' : ''} attached
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { reset(); onOpenChange(false) }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSend} disabled={!canSend}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5" />
                )}
                Send Email
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
