'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import {
  Ruler,
  FileText,
  Image as ImageIcon,
  StickyNote,
  FileSignature,
  FileCheck,
  MessageSquare,
  FolderOpen,
  ExternalLink,
  Download,
  File,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceFile {
  id: string
  category: string
  title: string
  description: string | null
  dropboxPath: string | null
  dropboxUrl: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
  isNote?: boolean
  noteContent?: string | null
  createdAt: string
  uploadedByUser: { id: string; name: string | null; image: string | null }
}

interface SourceCategory {
  category: string
  label: string
  folder: string
  description: string
  files: SourceFile[]
}

interface SourcesResponse {
  project: { id: string; name: string; dropboxFolder: string | null }
  categories: SourceCategory[]
  totalFiles: number
}

interface SourcesGridProps {
  projectId: string
  dropboxFolder: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  EXISTING_MEASUREMENTS: Ruler,
  ARCHITECT_PLANS: FileText,
  REFERENCE_IMAGES: ImageIcon,
  CLIENT_NOTES: StickyNote,
  PROPOSALS: FileSignature,
  CONTRACTS: FileCheck,
  COMMUNICATION: MessageSquare,
  OTHER: FolderOpen,
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  EXISTING_MEASUREMENTS: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  ARCHITECT_PLANS: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  REFERENCE_IMAGES: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  CLIENT_NOTES: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  PROPOSALS: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  CONTRACTS: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
  COMMUNICATION: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  OTHER: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
}

const ALL_CATEGORIES = [
  { value: null, label: 'All' },
  { value: 'EXISTING_MEASUREMENTS', label: 'Measurements' },
  { value: 'ARCHITECT_PLANS', label: 'Architect Plans' },
  { value: 'REFERENCE_IMAGES', label: 'Reference Images' },
  { value: 'CLIENT_NOTES', label: 'Client Notes' },
  { value: 'PROPOSALS', label: 'Proposals' },
  { value: 'CONTRACTS', label: 'Contracts' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'OTHER', label: 'Other' },
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getFileIcon(mimeType: string | null): { icon: React.ComponentType<{ className?: string }>; color: string } {
  if (!mimeType) return { icon: File, color: 'text-gray-400' }

  if (mimeType === 'application/pdf') return { icon: FileText, color: 'text-red-500' }
  if (mimeType.startsWith('image/')) return { icon: ImageIcon, color: 'text-blue-500' }
  if (
    mimeType.includes('dwg') ||
    mimeType.includes('autocad') ||
    mimeType.includes('acad')
  )
    return { icon: Ruler, color: 'text-green-500' }

  return { icon: File, color: 'text-gray-400' }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SourcesGrid({ projectId, dropboxFolder }: SourcesGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // ---- Data Fetching ----
  const { data, isLoading } = useSWR<SourcesResponse>(
    `/api/projects/${projectId}/sources`,
    fetcher
  )

  // ---- Derived data ----
  const categories = data?.categories ?? []
  const totalFiles = data?.totalFiles ?? 0

  // Count files per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const cat of categories) {
      counts[cat.category] = cat.files.length
    }
    return counts
  }, [categories])

  // All files (flattened) or filtered by active category
  const visibleFiles = useMemo(() => {
    if (!activeCategory) {
      return categories.flatMap((cat) => cat.files)
    }
    const cat = categories.find((c) => c.category === activeCategory)
    return cat?.files ?? []
  }, [categories, activeCategory])

  // Active category label (for empty state)
  const activeCategoryLabel = useMemo(() => {
    if (!activeCategory) return ''
    return ALL_CATEGORIES.find((c) => c.value === activeCategory)?.label ?? activeCategory
  }, [activeCategory])

  // ---- Loading State ----
  if (isLoading) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 bg-gray-200 rounded w-28 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded-full w-8 animate-pulse" />
        </div>
        {/* Filter chips skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded-full w-24 flex-shrink-0 animate-pulse" />
          ))}
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="h-5 bg-gray-200 rounded-full w-20" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---- Overall Empty State ----
  if (totalFiles === 0 && !activeCategory) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No source files yet</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Upload reference images, architect plans, measurements, and other project documents.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Source Files</h2>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {totalFiles}
        </span>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Category Filter Chips                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {ALL_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value
          const count =
            cat.value === null
              ? totalFiles
              : categoryCounts[cat.value] ?? 0
          const colors = cat.value ? CATEGORY_COLORS[cat.value] : null

          return (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 border',
                isActive
                  ? colors
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              )}
            >
              {cat.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full min-w-[20px] h-5 px-1.5 text-[10px] font-semibold',
                  isActive
                    ? colors
                      ? `${colors.text} bg-white/60`
                      : 'text-gray-900 bg-white/30'
                    : 'text-gray-500 bg-gray-100'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Empty state for filtered category                                */}
      {/* ---------------------------------------------------------------- */}
      {activeCategory && visibleFiles.length === 0 ? (
        <CategoryEmptyState
          category={activeCategory}
          label={activeCategoryLabel}
        />
      ) : (
        /* -------------------------------------------------------------- */
        /* Files Grid                                                      */
        /* -------------------------------------------------------------- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleFiles.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// File Card
// ---------------------------------------------------------------------------

function FileCard({ file }: { file: SourceFile }) {
  const isNote = file.isNote === true
  const { icon: FileIcon, color: iconColor } = isNote
    ? { icon: StickyNote, color: 'text-amber-500' }
    : getFileIcon(file.mimeType)
  const colors = CATEGORY_COLORS[file.category] ?? CATEGORY_COLORS.OTHER
  const CategoryIcon = CATEGORY_ICONS[file.category] ?? FolderOpen
  const categoryLabel =
    ALL_CATEGORIES.find((c) => c.value === file.category)?.label ?? file.category

  return (
    <div className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200">
      {/* Top row: icon + file info */}
      <div className="flex items-start gap-3 mb-3">
        {/* File type icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            isNote ? 'bg-amber-50' : 'bg-gray-50'
          )}
        >
          <FileIcon className={cn('w-5 h-5', iconColor)} />
        </div>

        {/* File name + description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={file.title}>
            {file.title}
          </p>
          {file.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{file.description}</p>
          )}
          {isNote && file.noteContent && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 italic">
              {file.noteContent}
            </p>
          )}
        </div>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
            colors.bg,
            colors.text,
            colors.border
          )}
        >
          <CategoryIcon className="w-3 h-3" />
          {categoryLabel}
        </span>
        {file.fileSize && (
          <span className="text-[10px] text-gray-400">{formatFileSize(file.fileSize)}</span>
        )}
      </div>

      {/* Bottom row: upload info + actions */}
      <div className="flex items-center justify-between">
        {/* Upload info */}
        <div className="flex items-center gap-1.5 min-w-0">
          {file.uploadedByUser.image ? (
            <img
              src={file.uploadedByUser.image}
              alt=""
              className="w-4 h-4 rounded-full flex-shrink-0"
            />
          ) : (
            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-[11px] text-gray-500 truncate">
            {file.uploadedByUser.name ?? 'Unknown'}
          </span>
          <span className="text-[11px] text-gray-300 flex-shrink-0">&middot;</span>
          <span className="text-[11px] text-gray-400 flex-shrink-0">
            {formatDate(file.createdAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.dropboxUrl && (
            <>
              <a
                href={file.dropboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Open in Dropbox"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={file.dropboxUrl.replace('dl=0', 'dl=1')}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category Empty State
// ---------------------------------------------------------------------------

function CategoryEmptyState({
  category,
  label,
}: {
  category: string
  label: string
}) {
  const Icon = CATEGORY_ICONS[category] ?? FolderOpen

  return (
    <div className="text-center py-12">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No {label} files yet</p>
    </div>
  )
}
