'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import {
  X,
  Download,
  FileText,
  PenTool,
  Box,
  Image as ImageIcon,
  Film,
  FileSpreadsheet,
  Presentation,
  Music,
  Archive,
  File,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileItem {
  id: string
  name: string
  path: string
  size: number
  lastModified: string
  thumbnailUrl?: string
  [key: string]: any
}

interface FileViewerProps {
  file: FileItem
  onClose: () => void
  onDownload: (file: any) => void
  projectId?: string
  onNavigateToSent?: () => void
  onNavigateToReceived?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then(r => r.json())

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

function getFileIcon(filename: string): { icon: any; colorClass: string; bgClass: string; label: string } {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) return { icon: PenTool, colorClass: 'text-blue-500', bgClass: 'bg-blue-50', label: 'CAD File' }
  if (lower.endsWith('.skp')) return { icon: Box, colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50', label: 'SketchUp File' }
  if (lower.endsWith('.max') || lower.endsWith('.3ds')) return { icon: Box, colorClass: 'text-orange-500', bgClass: 'bg-orange-50', label: '3D Model' }
  if (lower.endsWith('.psd') || lower.endsWith('.ai') || lower.endsWith('.indd')) return { icon: ImageIcon, colorClass: 'text-purple-500', bgClass: 'bg-purple-50', label: 'Design File' }
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|heic|tiff|bmp|svg)$/)) return { icon: ImageIcon, colorClass: 'text-teal-500', bgClass: 'bg-teal-50', label: 'Image' }
  if (lower.match(/\.(mp4|mov|avi|wmv|mkv)$/)) return { icon: Film, colorClass: 'text-indigo-500', bgClass: 'bg-indigo-50', label: 'Video' }
  if (lower.match(/\.(mp3|wav|aac|flac)$/)) return { icon: Music, colorClass: 'text-pink-500', bgClass: 'bg-pink-50', label: 'Audio' }
  if (lower.match(/\.(xlsx|xls|csv)$/)) return { icon: FileSpreadsheet, colorClass: 'text-green-600', bgClass: 'bg-green-50', label: 'Spreadsheet' }
  if (lower.match(/\.(pptx|ppt)$/)) return { icon: Presentation, colorClass: 'text-orange-500', bgClass: 'bg-orange-50', label: 'Presentation' }
  if (lower.match(/\.(docx|doc|txt|rtf)$/)) return { icon: FileText, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', label: 'Document' }
  if (lower.match(/\.(zip|rar|7z|tar|gz)$/)) return { icon: Archive, colorClass: 'text-gray-500', bgClass: 'bg-gray-100', label: 'Archive' }
  return { icon: File, colorClass: 'text-gray-400', bgClass: 'bg-gray-50', label: 'File' }
}

function getExtension(filename: string): string {
  return (filename.split('.').pop() || '').toUpperCase()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FileViewer({
  file,
  onClose,
  onDownload,
  projectId,
  onNavigateToSent,
  onNavigateToReceived,
}: FileViewerProps) {
  const { icon: FileIcon, colorClass, bgClass, label } = getFileIcon(file.name)
  const ext = getExtension(file.name)

  // Fetch transmittal history
  const { data: fileTransmittals } = useSWR(
    projectId && file.path
      ? `/api/projects/${projectId}/project-files-v2/file-transmittals?path=${encodeURIComponent(file.path)}`
      : null,
    fetcher
  )
  const transmittals = fileTransmittals?.transmittals ?? []

  // Fetch received file history
  const { data: fileReceivedData } = useSWR(
    projectId && file.path
      ? `/api/projects/${projectId}/project-files-v2/file-received?path=${encodeURIComponent(file.path)}`
      : null,
    fetcher
  )
  const receivedFiles = fileReceivedData?.receivedFiles ?? []

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-900/80 backdrop-blur-sm">
      {/* ---- MAIN AREA ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon className={cn('w-5 h-5 shrink-0', colorClass)} />
            <span className="text-sm font-medium text-white truncate">{file.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDownload(file)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File preview area */}
        <div className="flex-1 flex items-center justify-center bg-gray-800">
          {file.thumbnailUrl ? (
            <img
              src={file.thumbnailUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className={cn('w-32 h-32 rounded-2xl flex items-center justify-center', bgClass)}>
                <FileIcon className={cn('w-16 h-16', colorClass)} />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">{file.name}</p>
                <p className="text-sm text-gray-400 mt-1">{ext} · {formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => onDownload(file)}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---- RIGHT PROPERTIES PANEL ---- */}
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Filename */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-1 block">Name</label>
              <p className="text-sm text-gray-900 font-medium">{file.name}</p>
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-1 block">Type</label>
              <p className="text-sm text-gray-900">{ext} — {label}</p>
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-1 block">Date</label>
              <p className="text-sm text-gray-900">{formatDate(file.lastModified)}</p>
            </div>

            {/* Size */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-1 block">Size</label>
              <p className="text-sm text-gray-900">{formatFileSize(file.size)}</p>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-1 block">Location</label>
              <p className="text-xs text-gray-500 break-all leading-relaxed">{file.path}</p>
            </div>

            {/* Last Sent */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-2 block">Last Sent</label>
              {transmittals.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Not sent yet</p>
              ) : (
                <div className="space-y-2">
                  {transmittals.map((t: any, idx: number) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (onNavigateToSent) {
                          onClose()
                          onNavigateToSent()
                        }
                      }}
                      className={cn(
                        'rounded-lg border p-2.5 w-full text-left transition-colors',
                        idx === 0 ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50' : 'bg-gray-50 border-gray-100 hover:bg-gray-100',
                        onNavigateToSent && 'cursor-pointer'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{t.recipientName}</p>
                        {t.status === 'SENT' && idx === 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> Sent
                          </span>
                        )}
                      </div>
                      {t.recipientCompany && (
                        <p className="text-xs text-gray-500">{t.recipientCompany}</p>
                      )}
                      {t.recipientEmail && (
                        <p className="text-xs text-gray-400 mt-0.5">{t.recipientEmail}</p>
                      )}
                      {(t.title || t.section) && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {t.section && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              <span className={cn('h-1.5 w-1.5 rounded-full', t.section.color || 'bg-gray-400')} />
                              {t.section.name}
                            </span>
                          )}
                          {t.title && (
                            <span className="text-[11px] text-gray-600 truncate">{t.title}</span>
                          )}
                        </div>
                      )}
                      {t.sentAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(t.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {new Date(t.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-medium text-gray-400">{t.transmittalNumber}</span>
                        {onNavigateToSent && (
                          <span className="text-[10px] text-blue-500 font-medium">View in Sent →</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Last Received */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-2 block">Last Received</label>
              {receivedFiles.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Not received</p>
              ) : (
                <div className="space-y-2">
                  {receivedFiles.map((rf: any, idx: number) => (
                    <button
                      key={rf.id}
                      onClick={() => {
                        if (onNavigateToReceived) {
                          onClose()
                          onNavigateToReceived()
                        }
                      }}
                      className={cn(
                        'rounded-lg border p-2.5 w-full text-left transition-colors',
                        idx === 0 ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50' : 'bg-gray-50 border-gray-100 hover:bg-gray-100',
                        onNavigateToReceived && 'cursor-pointer'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{rf.senderName}</p>
                        {idx === 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                            <Download className="w-3 h-3" /> Received
                          </span>
                        )}
                      </div>
                      {rf.senderCompany && (
                        <p className="text-xs text-gray-500">{rf.senderCompany}</p>
                      )}
                      {rf.senderEmail && (
                        <p className="text-xs text-gray-400 mt-0.5">{rf.senderEmail}</p>
                      )}
                      {(rf.title || rf.section) && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {rf.section && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              <span className={cn('h-1.5 w-1.5 rounded-full', rf.section.color || 'bg-gray-400')} />
                              {rf.section.name}
                            </span>
                          )}
                          {rf.title && (
                            <span className="text-[11px] text-gray-600 truncate">{rf.title}</span>
                          )}
                        </div>
                      )}
                      {rf.receivedDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(rf.receivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {new Date(rf.receivedDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        {rf.loggedBy && (
                          <span className="text-[10px] font-medium text-gray-400">Logged by {rf.loggedBy}</span>
                        )}
                        {onNavigateToReceived && (
                          <span className="text-[10px] text-blue-500 font-medium ml-auto">View in Received →</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => onDownload(file)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download {ext}
          </button>
        </div>
      </div>
    </div>
  )
}
