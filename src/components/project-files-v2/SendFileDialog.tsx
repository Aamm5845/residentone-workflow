'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
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
  CheckCircle2,
  Image,
  FileSpreadsheet,
  File,
  CloudUpload,
  Mail,
  StickyNote,
  ChevronDown,
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
  base64?: string
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
  borderColor: string
}> = {
  CLIENT: { label: 'Client', icon: User, color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  CONTRACTOR: { label: 'Contractors', icon: HardHat, color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  SUBCONTRACTOR: { label: 'Subs', icon: Building2, color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  TEAM: { label: 'Team', icon: Users, color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  OTHER: { label: 'Previous', icon: Clock, color: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600', borderColor: 'border-gray-200' },
}
const CATEGORY_ORDER = ['CLIENT', 'CONTRACTOR', 'SUBCONTRACTOR', 'TEAM', 'OTHER']

const fetcher = (url: string) => fetch(url).then(r => r.json())

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Get icon for file type
function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return Image
  if (['pdf'].includes(ext)) return FileText
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet
  if (['doc', 'docx'].includes(ext)) return FileText
  return File
}

function getFileColor(filename: string) {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'text-emerald-500 bg-emerald-50'
  if (['pdf'].includes(ext)) return 'text-red-500 bg-red-50'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-green-600 bg-green-50'
  if (['doc', 'docx'].includes(ext)) return 'text-blue-500 bg-blue-50'
  if (['dwg', 'dxf'].includes(ext)) return 'text-purple-500 bg-purple-50'
  return 'text-gray-500 bg-gray-50'
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
  const [showSuccess, setShowSuccess] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(false)

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
    setShowSuccess(false)
    setIsDragging(false)
    setShowOptionalFields(false)
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

      setShowSuccess(true)
      setTimeout(() => {
        reset()
        onOpenChange(false)
        onSuccess?.()
      }, 1800)
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

  // Auto-expand first category that has contacts
  useEffect(() => {
    if (open && !hasRecipient && !showManualEntry && !expandedCategory) {
      const first = CATEGORY_ORDER.find(cat => groupedRecipients[cat]?.length)
      if (first) setExpandedCategory(first)
    }
  }, [open, hasRecipient, showManualEntry, expandedCategory, groupedRecipients])

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg font-semibold text-gray-900"
              >
                Email Sent
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-gray-500 mt-1"
              >
                {files.length} file{files.length !== 1 ? 's' : ''} sent to {recipientName}
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* ── Header ── */}
              <div className="px-6 pt-6 pb-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Send Files
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Attach files and send them via email
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* ── Scrollable body ── */}
              <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 pb-2">
                <div className="space-y-5">

                  {/* ── 1. FILES SECTION ── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">1</div>
                      <h3 className="text-sm font-semibold text-gray-900">Attach Files</h3>
                      {files.length > 0 && (
                        <span className="ml-auto text-xs font-medium text-gray-400">
                          {files.length} file{files.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Attached files list */}
                    <AnimatePresence>
                      {files.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mb-3 space-y-1.5 overflow-hidden"
                        >
                          {files.map((f, i) => {
                            const FileIcon = getFileIcon(f.name)
                            const colorClass = getFileColor(f.name)
                            return (
                              <motion.div
                                key={`${f.name}-${i}`}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 12 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 px-3 py-2.5 group hover:border-gray-200 transition-colors"
                              >
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
                                  <FileIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {formatFileSize(f.size)}
                                    <span className="mx-1.5">·</span>
                                    {f.source === 'dropbox' ? 'Dropbox' : 'Upload'}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeFile(i)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded-lg hover:bg-red-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Dropbox Picker */}
                    <AnimatePresence mode="wait">
                      {showDropboxPicker ? (
                        <motion.div
                          key="dropbox-picker"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                        >
                          {/* Breadcrumb */}
                          <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs">
                            <Folder className="w-3.5 h-3.5 text-blue-500 mr-1" />
                            <button
                              onClick={() => setDropboxPath('')}
                              className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            >
                              Root
                            </button>
                            {pathParts.map((part, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <ChevronRight className="w-3 h-3 text-gray-300" />
                                <button
                                  onClick={() => setDropboxPath(pathParts.slice(0, i + 1).join('/'))}
                                  className={cn(
                                    'truncate max-w-[120px]',
                                    i === pathParts.length - 1
                                      ? 'text-gray-900 font-medium'
                                      : 'text-blue-600 hover:text-blue-800 hover:underline'
                                  )}
                                >
                                  {part}
                                </button>
                              </span>
                            ))}
                          </div>

                          {/* Content */}
                          <div className="max-h-56 overflow-y-auto">
                            {browsing ? (
                              <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                              </div>
                            ) : (
                              <>
                                {dropboxPath && (
                                  <button
                                    onClick={() => {
                                      const parts = dropboxPath.split('/')
                                      parts.pop()
                                      setDropboxPath(parts.join('/'))
                                    }}
                                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors border-b border-gray-50"
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Back</span>
                                  </button>
                                )}

                                {folders.map((folder: any) => (
                                  <button
                                    key={folder.path}
                                    onClick={() => setDropboxPath(folder.path)}
                                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm hover:bg-blue-50/50 transition-colors"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                      <Folder className="w-3.5 h-3.5 text-blue-500" />
                                    </div>
                                    <span className="text-gray-900 truncate text-[13px]">{folder.name}</span>
                                  </button>
                                ))}

                                {browseFiles.map((file: any) => {
                                  const alreadyAdded = files.some(f => f.dropboxPath === file.path)
                                  const FileIcon = getFileIcon(file.name)
                                  const colorClass = getFileColor(file.name)
                                  return (
                                    <button
                                      key={file.path}
                                      onClick={() => !alreadyAdded && addDropboxFile(file)}
                                      disabled={alreadyAdded}
                                      className={cn(
                                        'flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors',
                                        alreadyAdded ? 'opacity-50 bg-green-50/50' : 'hover:bg-gray-50'
                                      )}
                                    >
                                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', colorClass)}>
                                        <FileIcon className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-gray-900 truncate flex-1 text-left text-[13px]">{file.name}</span>
                                      {alreadyAdded ? (
                                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                                      ) : (
                                        <span className="text-[11px] text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
                                      )}
                                    </button>
                                  )
                                })}

                                {folders.length === 0 && browseFiles.length === 0 && !browsing && (
                                  <div className="py-8 text-center text-sm text-gray-400">
                                    Empty folder
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Close picker */}
                          <div className="px-3 py-2 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => { setShowDropboxPicker(false); setDropboxPath('') }}
                            >
                              Close
                            </Button>
                          </div>
                        </motion.div>
                      ) : (
                        /* Drop zone + source buttons */
                        <motion.div
                          key="drop-zone"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            className={cn(
                              'relative border-2 border-dashed rounded-xl transition-all duration-200',
                              isDragging
                                ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
                                : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'
                            )}
                          >
                            <div className="py-6 px-4 flex flex-col items-center">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors',
                                isDragging ? 'bg-blue-100 text-blue-500' : 'bg-gray-100 text-gray-400'
                              )}>
                                <CloudUpload className="w-5 h-5" />
                              </div>
                              <p className="text-sm text-gray-500 mb-1">
                                Drop files here or choose a source
                              </p>
                              <p className="text-xs text-gray-400 mb-4">
                                PDF, images, documents, spreadsheets
                              </p>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs rounded-lg shadow-sm"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                                  Upload
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs rounded-lg shadow-sm"
                                  onClick={() => setShowDropboxPicker(true)}
                                >
                                  <Folder className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                                  Dropbox
                                </Button>
                              </div>
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* ── 2. RECIPIENT SECTION ── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                        hasRecipient ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'
                      )}>
                        {hasRecipient ? <Check className="w-3.5 h-3.5" /> : '2'}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">Recipient</h3>
                    </div>

                    {/* Selected recipient */}
                    <AnimatePresence mode="wait">
                      {hasRecipient && !showManualEntry ? (
                        <motion.div
                          key="selected"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 px-3 py-2.5 group hover:border-gray-200 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                            {recipientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{recipientName}</p>
                            <p className="text-xs text-gray-400">{recipientEmail}</p>
                          </div>
                          <button
                            onClick={() => { setRecipientName(''); setRecipientEmail('') }}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded-lg hover:bg-red-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ) : showManualEntry ? (
                        <motion.div
                          key="manual"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="space-y-2"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Name"
                              value={recipientName}
                              onChange={(e) => setRecipientName(e.target.value)}
                              className="h-9 text-sm rounded-lg"
                            />
                            <Input
                              placeholder="Email"
                              type="email"
                              value={recipientEmail}
                              onChange={(e) => setRecipientEmail(e.target.value)}
                              className="h-9 text-sm rounded-lg"
                            />
                          </div>
                          <button
                            onClick={() => setShowManualEntry(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            ← Choose from contacts
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="picker"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="space-y-2"
                        >
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
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                                    isExpanded
                                      ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`
                                      : 'bg-white border-gray-150 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
                                  )}
                                >
                                  <Icon className="w-3 h-3" />
                                  {cfg.label}
                                  <span className="opacity-50">{group.length}</span>
                                </button>
                              )
                            })}
                            <button
                              onClick={() => setShowManualEntry(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-dashed border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all"
                            >
                              <UserPlus className="w-3 h-3" />
                              Manual
                            </button>
                          </div>

                          {/* Expanded contact list */}
                          <AnimatePresence>
                            {expandedCategory && groupedRecipients[expandedCategory] && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-xl border border-gray-100 bg-white overflow-hidden max-h-36 overflow-y-auto">
                                  {groupedRecipients[expandedCategory].map((r, i) => (
                                    <button
                                      key={i}
                                      onClick={() => selectRecipient(r)}
                                      className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                                        {r.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                                        <p className="text-xs text-gray-400 truncate">
                                          {r.email}
                                          {r.company && <span className="text-gray-300"> · {r.company}</span>}
                                        </p>
                                      </div>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {recipients.length === 0 && (
                            <p className="text-xs text-gray-400 pt-1">
                              No contacts yet.{' '}
                              <button onClick={() => setShowManualEntry(true)} className="text-blue-600 hover:underline">
                                Enter manually
                              </button>
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* ── 3. OPTIONAL: Subject + Notes (collapsed by default) ── */}
                  <section>
                    <button
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                      className="flex items-center gap-2 w-full text-left group"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-semibold">
                        3
                      </div>
                      <h3 className="text-sm font-semibold text-gray-400 group-hover:text-gray-600 transition-colors">
                        Subject & Notes
                      </h3>
                      <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider ml-1">Optional</span>
                      <ChevronDown className={cn(
                        'w-3.5 h-3.5 text-gray-300 ml-auto transition-transform',
                        showOptionalFields && 'rotate-180'
                      )} />
                    </button>

                    <AnimatePresence>
                      {showOptionalFields && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 pt-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Subject</label>
                              <Input
                                placeholder="e.g. Updated floor plans"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="h-9 text-sm rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Notes</label>
                              <Textarea
                                placeholder="Any notes for the recipient..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="text-sm resize-none rounded-lg"
                                rows={2}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                </div>
              </div>

              {/* ── ERROR ── */}
              <AnimatePresence>
                {submitError && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 overflow-hidden"
                  >
                    <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
                      <X className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Footer / Actions ── */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {files.length > 0 && (
                    <>
                      <Paperclip className="w-3 h-3" />
                      <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                  {hasRecipient && files.length > 0 && (
                    <>
                      <span>→</span>
                      <span className="truncate max-w-[140px]">{recipientName}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => { reset(); onOpenChange(false) }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs rounded-lg px-4 shadow-sm"
                    onClick={handleSend}
                    disabled={!canSend}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Send Email
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
