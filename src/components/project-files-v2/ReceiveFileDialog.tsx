'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { upload } from '@vercel/blob/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  Upload,
  X,
  Download,
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
  ChevronDown,
  Plus,
  Calendar,
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
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileWithMetadata {
  id: string
  name: string
  size: number
  source: 'upload' | 'dropbox'
  file?: File
  dropboxPath?: string
  sectionId: string
  title: string
  fileNotes: string
}

interface Contact {
  name: string
  email: string
  company: string | null
  type: string
}

interface Section {
  id: string
  name: string
  shortName: string
  color: string
}

interface ReceiveFileDialogProps {
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

const SECTION_COLORS = [
  'bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-red-500',
]

const PRESET_SECTIONS = [
  { name: 'General', shortName: 'GEN', color: 'bg-gray-500' },
  { name: 'Existing Drawings', shortName: 'EXD', color: 'bg-blue-500' },
  { name: 'Structural', shortName: 'STR', color: 'bg-amber-500' },
  { name: 'HVAC', shortName: 'HVAC', color: 'bg-green-500' },
  { name: 'Mechanical', shortName: 'MECH', color: 'bg-purple-500' },
  { name: 'Electrical', shortName: 'ELEC', color: 'bg-orange-500' },
  { name: 'Plumbing', shortName: 'PLMB', color: 'bg-pink-500' },
  { name: 'Spec Sheets', shortName: 'SPEC', color: 'bg-teal-500' },
  { name: 'Shop Drawings', shortName: 'SHOP', color: 'bg-red-500' },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReceiveFileDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: ReceiveFileDialogProps) {
  // ── Sender state (single selection) ──
  const [selectedSender, setSelectedSender] = useState<Contact | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualCompany, setManualCompany] = useState('')
  const [receivedDate, setReceivedDate] = useState(todayISO())

  // ── File state ──
  const [files, setFiles] = useState<FileWithMetadata[]>([])
  const [showDropboxPicker, setShowDropboxPicker] = useState(false)
  const [dropboxPath, setDropboxPath] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Global section ──
  const [globalSectionId, setGlobalSectionId] = useState('none')
  const [showSectionPicker, setShowSectionPicker] = useState(false)
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null)

  // ── Section creation ──
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionShortName, setNewSectionShortName] = useState('')
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLORS[0])
  const [isCreatingSection, setIsCreatingSection] = useState(false)

  // ── Form state ──
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // ── Data ──
  const { data: contactsData } = useSWR<Contact[]>(
    open ? `/api/projects/${projectId}/project-files-v2/recipients` : null,
    fetcher
  )
  const { data: sectionsData, mutate: mutateSections } = useSWR<Section[]>(
    open ? `/api/projects/${projectId}/project-files-v2/sections` : null,
    fetcher
  )
  const { data: browseData, isLoading: browsing } = useSWR(
    open && showDropboxPicker
      ? `/api/projects/${projectId}/project-files-v2/browse?path=${encodeURIComponent(dropboxPath)}`
      : null,
    fetcher
  )

  const contacts = contactsData ?? []
  const sections: Section[] = Array.isArray(sectionsData) ? sectionsData : []

  const groupedContacts = useMemo(() => {
    const groups: Record<string, Contact[]> = {}
    for (const r of contacts) {
      const cat = r.type?.toUpperCase() || 'OTHER'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(r)
    }
    return groups
  }, [contacts])

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const hasSender = selectedSender !== null
  const allFilesValid = files.length > 0 && globalSectionId && globalSectionId !== 'none' && files.every(f => f.title.trim())
  const canSubmit = allFilesValid && hasSender && !isSubmitting

  const availablePresets = useMemo(() =>
    PRESET_SECTIONS.filter(p => !sections.some(s => s.name.toLowerCase() === p.name.toLowerCase())),
    [sections]
  )
  const selectedSection = sections.find(s => s.id === globalSectionId)

  // ── Reset ──
  const reset = useCallback(() => {
    setSelectedSender(null)
    setExpandedCategory(null)
    setShowManualEntry(false)
    setManualName('')
    setManualEmail('')
    setManualCompany('')
    setReceivedDate(todayISO())
    setFiles([])
    setShowDropboxPicker(false)
    setDropboxPath('')
    setGlobalSectionId('none')
    setShowSectionPicker(false)
    setCreatingPreset(null)
    setShowAddSection(false)
    setNewSectionName('')
    setNewSectionShortName('')
    setNewSectionColor(SECTION_COLORS[0])
    setIsSubmitting(false)
    setSubmitError(null)
    setShowSuccess(false)
    setIsDragging(false)
  }, [])

  // ── File handlers ──
  const handleFileUpload = useCallback(async (fileList: FileList) => {
    const newFiles: FileWithMetadata[] = []
    for (const file of Array.from(fileList)) {
      newFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        source: 'upload',
        file,
        sectionId: globalSectionId,
        title: stripExtension(file.name),
        fileNotes: '',
      })
    }
    setFiles(prev => [...prev, ...newFiles])
  }, [globalSectionId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files)
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])

  const removeFile = useCallback((id: string) => setFiles(prev => prev.filter(f => f.id !== id)), [])
  const updateFile = useCallback((id: string, updates: Partial<FileWithMetadata>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const addDropboxFile = useCallback((file: { name: string; path: string; size: number }) => {
    setFiles(prev => [...prev, {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      source: 'dropbox',
      dropboxPath: file.path,
      sectionId: globalSectionId,
      title: stripExtension(file.name),
      fileNotes: '',
    }])
  }, [globalSectionId])

  // ── Sender handlers ──
  const selectContact = useCallback((c: Contact) => {
    setSelectedSender(c)
    setExpandedCategory(null)
  }, [])

  const addManualSender = useCallback(() => {
    if (!manualName.trim()) return
    setSelectedSender({
      name: manualName.trim(),
      email: manualEmail.trim() || '',
      company: manualCompany.trim() || null,
      type: 'OTHER',
    })
    setManualName('')
    setManualEmail('')
    setManualCompany('')
    setShowManualEntry(false)
  }, [manualName, manualEmail, manualCompany])

  // ── Section handlers ──
  const handleSelectSection = useCallback((sectionId: string) => {
    setGlobalSectionId(sectionId)
    setFiles(prev => prev.map(f => ({ ...f, sectionId })))
    setShowSectionPicker(false)
  }, [])

  const handleSelectPreset = useCallback(async (preset: typeof PRESET_SECTIONS[0]) => {
    setCreatingPreset(preset.name)
    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v2/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      })
      if (!res.ok) throw new Error('Failed to create section')
      const created = await res.json()
      mutateSections()
      setGlobalSectionId(created.id)
      setFiles(prev => prev.map(f => ({ ...f, sectionId: created.id })))
      setShowSectionPicker(false)
    } catch (err) {
      console.error('Failed to create preset section:', err)
    } finally {
      setCreatingPreset(null)
    }
  }, [projectId, mutateSections])

  const handleCreateSection = useCallback(async () => {
    if (!newSectionName.trim() || !newSectionShortName.trim()) return
    setIsCreatingSection(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v2/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName.trim(), shortName: newSectionShortName.trim(), color: newSectionColor }),
      })
      if (!res.ok) throw new Error('Failed to create section')
      const created = await res.json()
      mutateSections()
      setShowAddSection(false)
      setNewSectionName('')
      setNewSectionShortName('')
      setNewSectionColor(SECTION_COLORS[0])
      setGlobalSectionId(created.id)
      setFiles(prev => prev.map(f => ({ ...f, sectionId: created.id })))
    } catch (err) {
      console.error('Failed to create section:', err)
    } finally {
      setIsCreatingSection(false)
    }
  }, [projectId, newSectionName, newSectionShortName, newSectionColor, mutateSections])

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedSender) return
    setIsSubmitting(true)
    setSubmitError(null)

    const MAX_DIRECT_SIZE = 4 * 1024 * 1024 // 4MB — Vercel serverless body limit

    try {
      // Step 1: Upload each local file to Dropbox first (same pattern as Photos tab)
      const sectionName = sections.find(s => s.id === globalSectionId)?.name || 'Unsorted'
      const dateStr = receivedDate || todayISO()
      const targetPath = `6- Documents/${sectionName}/${dateStr}`

      const processedFiles: Array<{
        name: string; size: number; source: 'dropbox'; dropboxPath: string
        sectionId: string; title: string; fileNotes: string | null
      }> = []

      for (const f of files) {
        if (f.source === 'upload' && f.file) {
          const sanitizedName = f.file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')

          if (f.file.size > MAX_DIRECT_SIZE) {
            // Large file: upload to Vercel Blob first, then transfer to Dropbox
            const blobPath = `receive-files/${projectId}/${Date.now()}-${sanitizedName}`
            const blob = await upload(blobPath, f.file, {
              access: 'public',
              handleUploadUrl: '/api/blob-upload',
              contentType: 'application/octet-stream',
            })
            await fetch(`/api/projects/${projectId}/project-files-v2/upload-from-blob`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ blobUrl: blob.url, fileName: f.file.name, targetPath }),
            })
          } else {
            // Small file: direct FormData upload
            const formData = new FormData()
            formData.append('file', f.file)
            formData.append('path', targetPath)
            await fetch(`/api/projects/${projectId}/project-files-v2/upload`, {
              method: 'POST',
              body: formData,
            })
          }

          processedFiles.push({
            name: f.name,
            size: f.size,
            source: 'dropbox',
            dropboxPath: `${targetPath}/${sanitizedName}`,
            sectionId: globalSectionId,
            title: f.title.trim(),
            fileNotes: f.fileNotes.trim() || null,
          })
        } else {
          // Dropbox-sourced file — already in Dropbox
          processedFiles.push({
            name: f.name,
            size: f.size,
            source: 'dropbox',
            dropboxPath: f.dropboxPath || '',
            sectionId: globalSectionId,
            title: f.title.trim(),
            fileNotes: f.fileNotes.trim() || null,
          })
        }
      }

      // Step 2: Call receive-files API with metadata only (no base64)
      const res = await fetch(`/api/projects/${projectId}/project-files-v2/receive-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: {
            name: selectedSender.name,
            email: selectedSender.email || null,
            company: selectedSender.company || null,
            type: selectedSender.type || 'OTHER',
          },
          receivedDate: receivedDate ? `${receivedDate}T12:00:00` : null,
          notes: null,
          files: processedFiles,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to log received files')
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
  }, [canSubmit, selectedSender, projectId, receivedDate, files, globalSectionId, sections, reset, onOpenChange, onSuccess])

  // ── Dropbox browser ──
  const folders = browseData?.folders ?? []
  const browseFiles = (browseData?.files ?? []).filter((f: any) => !f.isFolder)
  const pathParts = dropboxPath ? dropboxPath.split('/') : []

  // Auto-expand first category
  useEffect(() => {
    if (open && !hasSender && !showManualEntry && !expandedCategory) {
      const first = CATEGORY_ORDER.find(cat => groupedContacts[cat]?.length)
      if (first) setExpandedCategory(first)
    }
  }, [open, hasSender, showManualEntry, expandedCategory, groupedContacts])

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg font-semibold text-gray-900">
                Files Logged
              </motion.p>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-sm text-gray-500 mt-1">
                {files.length} file{files.length !== 1 ? 's' : ''} received from {selectedSender?.name}
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* ── Header ── */}
              <div className="px-6 pt-6 pb-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg font-semibold text-gray-900">Receive Files</DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Log files received from a client, contractor, or consultant
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* ── Scrollable body ── */}
              <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 pb-2">
                <div className="space-y-5">

                  {/* ══════════ 1. FROM (Sender) ══════════ */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                        hasSender ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'
                      )}>
                        {hasSender ? <Check className="w-3.5 h-3.5" /> : '1'}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">From</h3>
                    </div>

                    {/* Selected sender chip */}
                    {selectedSender && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 group">
                          <span className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-white">
                            {selectedSender.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[180px]">{selectedSender.name}</span>
                          {selectedSender.company && (
                            <span className="text-gray-400">· {selectedSender.company}</span>
                          )}
                          <button onClick={() => setSelectedSender(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      </div>
                    )}

                    {/* Contact categories */}
                    {!selectedSender && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORY_ORDER.map(cat => {
                            const cfg = CATEGORY_CONFIG[cat]
                            const group = groupedContacts[cat]
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
                            onClick={() => setShowManualEntry(!showManualEntry)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              showManualEntry
                                ? 'bg-gray-100 border-gray-300 text-gray-700'
                                : 'bg-white border-dashed border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                            )}
                          >
                            <UserPlus className="w-3 h-3" />
                            Manual
                          </button>
                        </div>

                        {/* Manual entry */}
                        <AnimatePresence>
                          {showManualEntry && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                              <div className="mt-2 space-y-2">
                                <div className="grid grid-cols-5 gap-2">
                                  <Input placeholder="Name *" value={manualName} onChange={(e) => setManualName(e.target.value)} className="h-8 text-xs rounded-lg col-span-2" />
                                  <Input placeholder="Email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="h-8 text-xs rounded-lg col-span-2" onKeyDown={(e) => e.key === 'Enter' && addManualSender()} />
                                  <Button size="sm" className="h-8 text-xs" onClick={addManualSender} disabled={!manualName.trim()}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                                <Input placeholder="Company" value={manualCompany} onChange={(e) => setManualCompany(e.target.value)} className="h-8 text-xs rounded-lg" onKeyDown={(e) => e.key === 'Enter' && addManualSender()} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Expanded contact list (single-select) */}
                        <AnimatePresence>
                          {expandedCategory && groupedContacts[expandedCategory] && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                              <div className="mt-2 rounded-xl border border-gray-100 bg-white overflow-hidden max-h-40 overflow-y-auto">
                                {groupedContacts[expandedCategory].map((c, i) => (
                                  <button
                                    key={i}
                                    onClick={() => selectContact(c)}
                                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                                      {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                                      <p className="text-xs text-gray-400 truncate">
                                        {c.email}
                                        {c.company && <span className="text-gray-300"> · {c.company}</span>}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {contacts.length === 0 && !showManualEntry && (
                          <p className="text-xs text-gray-400 pt-2">
                            No contacts yet.{' '}
                            <button onClick={() => setShowManualEntry(true)} className="text-blue-600 hover:underline">Enter manually</button>
                          </p>
                        )}
                      </>
                    )}

                    {/* Date picker */}
                    <div className="mt-3 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-500">Received</label>
                      <input
                        type="date"
                        value={receivedDate}
                        onChange={(e) => setReceivedDate(e.target.value)}
                        className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                  </section>

                  {/* ══════════ 2. SECTION SELECTION ══════════ */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                        globalSectionId && globalSectionId !== 'none' ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'
                      )}>
                        {globalSectionId && globalSectionId !== 'none' ? <Check className="w-3.5 h-3.5" /> : '2'}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">Section</h3>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowSectionPicker(!showSectionPicker)}
                        className={cn(
                          'w-full h-9 px-3 rounded-lg border text-sm text-left flex items-center gap-2 transition-colors',
                          (!globalSectionId || globalSectionId === 'none') ? 'border-red-200 text-gray-400' : 'border-gray-200 text-gray-900',
                          'hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10'
                        )}
                      >
                        {selectedSection ? (
                          <>
                            <span className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', selectedSection.color || 'bg-gray-400')} />
                            {selectedSection.name}
                          </>
                        ) : (
                          'Select section...'
                        )}
                        <ChevronDown className={cn('w-4 h-4 ml-auto text-gray-400 transition-transform', showSectionPicker && 'rotate-180')} />
                      </button>

                      <AnimatePresence>
                        {showSectionPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                            className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
                          >
                            <div className="max-h-64 overflow-y-auto">
                              {sections.length > 0 && (
                                <>
                                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Your Sections</p>
                                  {sections.map((s) => (
                                    <button key={s.id} type="button" onClick={() => handleSelectSection(s.id)}
                                      className={cn('flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors', globalSectionId === s.id ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50')}>
                                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.color || 'bg-gray-400')} />
                                      <span className="text-gray-900">{s.name}</span>
                                      {globalSectionId === s.id && <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                                    </button>
                                  ))}
                                </>
                              )}
                              {availablePresets.length > 0 && (
                                <>
                                  {sections.length > 0 && <div className="border-t border-gray-100 my-1" />}
                                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Presets</p>
                                  {availablePresets.map((p) => (
                                    <button key={p.name} type="button" onClick={() => handleSelectPreset(p)} disabled={!!creatingPreset}
                                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0 opacity-60', p.color)} />
                                      <span className="text-gray-600">{p.name}</span>
                                      {creatingPreset === p.name && <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />}
                                    </button>
                                  ))}
                                </>
                              )}
                              <div className="border-t border-gray-100 my-1" />
                              <button type="button" onClick={() => { setShowSectionPicker(false); setShowAddSection(true) }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50/50 transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                                Add Custom Section
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Inline custom section creation */}
                    <AnimatePresence>
                      {showAddSection && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                            <p className="text-xs font-semibold text-gray-700">New Section</p>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="Section name" className="h-8 px-2.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400" />
                              <input type="text" value={newSectionShortName} onChange={(e) => setNewSectionShortName(e.target.value)} placeholder="Short name (e.g. FP)" className="h-8 px-2.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400" />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {SECTION_COLORS.map((color) => (
                                <button key={color} type="button" onClick={() => setNewSectionColor(color)}
                                  className={cn('w-5 h-5 rounded-full transition-all', color, newSectionColor === color ? 'ring-2 ring-offset-1 ring-gray-700 scale-110' : 'opacity-60 hover:opacity-100')} />
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" onClick={handleCreateSection} disabled={isCreatingSection || !newSectionName.trim() || !newSectionShortName.trim()} className="h-7 text-xs">
                                {isCreatingSection ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                                Save
                              </Button>
                              <button type="button" onClick={() => { setShowAddSection(false); setNewSectionName(''); setNewSectionShortName('') }} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* ══════════ 3. FILES SECTION ══════════ */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                        files.length > 0 && files.every(f => f.title.trim()) ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'
                      )}>
                        {files.length > 0 && files.every(f => f.title.trim()) ? <Check className="w-3.5 h-3.5" /> : '3'}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">Attach Files</h3>
                      {files.length > 0 && (
                        <span className="ml-auto text-xs font-medium text-gray-400">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Dropbox Picker */}
                    <AnimatePresence mode="wait">
                      {showDropboxPicker ? (
                        <motion.div key="dropbox-picker" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          className="border border-gray-200 rounded-xl overflow-hidden bg-white mb-3">
                          <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs">
                            <Folder className="w-3.5 h-3.5 text-blue-500 mr-1" />
                            <button onClick={() => setDropboxPath('')} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">Root</button>
                            {pathParts.map((part, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <ChevronRight className="w-3 h-3 text-gray-300" />
                                <button onClick={() => setDropboxPath(pathParts.slice(0, i + 1).join('/'))}
                                  className={cn('truncate max-w-[120px]', i === pathParts.length - 1 ? 'text-gray-900 font-medium' : 'text-blue-600 hover:text-blue-800 hover:underline')}>
                                  {part}
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {browsing ? (
                              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                            ) : (
                              <>
                                {dropboxPath && (
                                  <button onClick={() => { const parts = dropboxPath.split('/'); parts.pop(); setDropboxPath(parts.join('/')) }}
                                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors border-b border-gray-50">
                                    <ArrowLeft className="w-3.5 h-3.5" /><span className="text-xs font-medium">Back</span>
                                  </button>
                                )}
                                {folders.map((folder: any) => (
                                  <button key={folder.path} onClick={() => setDropboxPath(folder.path)}
                                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm hover:bg-blue-50/50 transition-colors">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Folder className="w-3.5 h-3.5 text-blue-500" /></div>
                                    <span className="text-gray-900 truncate text-[13px]">{folder.name}</span>
                                  </button>
                                ))}
                                {browseFiles.map((file: any) => {
                                  const alreadyAdded = files.some(f => f.dropboxPath === file.path)
                                  const FileIcon = getFileIcon(file.name)
                                  const colorClass = getFileColor(file.name)
                                  return (
                                    <button key={file.path} onClick={() => !alreadyAdded && addDropboxFile(file)} disabled={alreadyAdded}
                                      className={cn('flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors', alreadyAdded ? 'opacity-50 bg-green-50/50' : 'hover:bg-gray-50')}>
                                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', colorClass)}><FileIcon className="w-3.5 h-3.5" /></div>
                                      <span className="text-gray-900 truncate flex-1 text-left text-[13px]">{file.name}</span>
                                      {alreadyAdded ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <span className="text-[11px] text-gray-400 shrink-0">{formatFileSize(file.size)}</span>}
                                    </button>
                                  )
                                })}
                                {folders.length === 0 && browseFiles.length === 0 && !browsing && (
                                  <div className="py-8 text-center text-sm text-gray-400">Empty folder</div>
                                )}
                              </>
                            )}
                          </div>
                          <div className="px-3 py-2 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setShowDropboxPicker(false); setDropboxPath('') }}>Close</Button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="drop-zone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                            className={cn('relative border-2 border-dashed rounded-xl transition-all duration-200',
                              isDragging ? 'border-blue-400 bg-blue-50/50 scale-[1.01]' : 'border-gray-200 hover:border-gray-300 bg-gray-50/30')}>
                            <div className="py-5 px-4 flex flex-col items-center">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors',
                                isDragging ? 'bg-blue-100 text-blue-500' : 'bg-gray-100 text-gray-400')}>
                                <CloudUpload className="w-5 h-5" />
                              </div>
                              <p className="text-sm text-gray-500 mb-1">Drop files here or choose a source</p>
                              <p className="text-xs text-gray-400 mb-3">PDF, images, documents, spreadsheets</p>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg shadow-sm" onClick={() => fileInputRef.current?.click()}>
                                  <Upload className="w-3.5 h-3.5 mr-1.5" />Upload
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg shadow-sm" onClick={() => setShowDropboxPicker(true)}>
                                  <Folder className="w-3.5 h-3.5 mr-1.5 text-blue-500" />Dropbox
                                </Button>
                              </div>
                            </div>
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFileUpload(e.target.files); e.target.value = '' }} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Per-file cards */}
                    <AnimatePresence>
                      {files.length > 0 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 space-y-2 overflow-hidden">
                          {files.map((f) => {
                            const FileIcon = getFileIcon(f.name)
                            const colorClass = getFileColor(f.name)
                            const missingTitle = !f.title.trim()
                            return (
                              <motion.div key={f.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }}
                                className="rounded-xl bg-white border border-gray-150 overflow-hidden">
                                <div className="flex items-center gap-3 px-3 py-2.5 group">
                                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', colorClass)}><FileIcon className="w-4 h-4" /></div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                                    <p className="text-xs text-gray-400">{formatFileSize(f.size)}<span className="mx-1.5">·</span>{f.source === 'dropbox' ? 'Dropbox' : 'Upload'}</p>
                                  </div>
                                  <button onClick={() => removeFile(f.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded-lg hover:bg-red-50">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2.5">
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Title <span className="text-red-400">*</span></label>
                                    <input type="text" value={f.title} onChange={(e) => updateFile(f.id, { title: e.target.value })} placeholder="Drawing title"
                                      className={cn('w-full h-8 px-2.5 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 placeholder:text-gray-400',
                                        missingTitle ? 'border-red-200' : 'border-gray-200')} />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Notes</label>
                                    <input type="text" value={f.fileNotes} onChange={(e) => updateFile(f.id, { fileNotes: e.target.value })} placeholder="Optional notes"
                                      className="w-full h-7 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-300" />
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                </div>
              </div>

              {/* ── ERROR ── */}
              <AnimatePresence>
                {submitError && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 overflow-hidden">
                    <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
                      <X className="w-4 h-4 shrink-0 mt-0.5" /><span>{submitError}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Footer ── */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {files.length > 0 && (
                    <>
                      <Paperclip className="w-3 h-3" />
                      <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                  {hasSender && files.length > 0 && (
                    <>
                      <span>from</span>
                      <span className="text-gray-600 font-medium">{selectedSender?.name}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
                  <Button size="sm" className="h-8 text-xs rounded-lg px-4 shadow-sm" onClick={handleSubmit} disabled={!canSubmit}>
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                    Log Files
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
