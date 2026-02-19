'use client'

import React, { useEffect, useState } from 'react'
import {
  X,
  FileText,
  ExternalLink,
  Edit2,
  Plus,
  Send,
  Clock,
  User,
  Layers,
  MapPin,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import CadFreshnessBadge, { type CadFreshnessStatusType } from './CadFreshnessBadge'

// ─── Shared Configs ──────────────────────────────────────────────────────────

const DISCIPLINE_CONFIG: Record<
  string,
  { label: string; shortLabel: string; color: string; bgColor: string; textColor: string }
> = {
  ARCHITECTURAL: { label: 'Architectural', shortLabel: 'ARCH', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  ELECTRICAL: { label: 'Electrical', shortLabel: 'ELEC', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  RCP: { label: 'RCP', shortLabel: 'RCP', color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  PLUMBING: { label: 'Plumbing', shortLabel: 'PLMB', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  MECHANICAL: { label: 'Mechanical', shortLabel: 'MECH', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  INTERIOR_DESIGN: { label: 'Interior Design', shortLabel: 'INT', color: 'bg-pink-500', bgColor: 'bg-pink-50', textColor: 'text-pink-700' },
}

const DRAWING_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  REFLECTED_CEILING: 'Reflected Ceiling',
  ELEVATION: 'Elevation',
  DETAIL: 'Detail',
  SECTION: 'Section',
  TITLE_BLOCK: 'Title Block',
  XREF: 'XREF',
  SCHEDULE: 'Schedule',
  OTHER: 'Other',
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DrawingDetail {
  id: string
  drawingNumber: string
  title: string
  discipline: string | null
  drawingType: string | null
  status: string
  currentRevision: number
  description: string | null
  dropboxPath: string | null
  dropboxUrl: string | null
  fileName: string | null
  fileSize: number | null
  scale: string | null
  paperSize: string | null
  createdAt: string
  floor: { id: string; name: string; shortName: string } | null
  creator: { id: string; name: string | null }
  revisions: Array<{
    id: string
    revisionNumber: number
    description: string | null
    dropboxPath: string | null
    dropboxUrl: string | null
    fileName: string | null
    fileSize: number | null
    issuedDate: string
    issuedByUser: { id: string; name: string | null }
  }>
  cadSourceLink?: {
    id: string
    cadDropboxPath: string
    cadLayoutName: string | null
    cadFreshnessStatus: CadFreshnessStatusType
    plottedFromRevision: string | null
    plottedAt: string | null
  } | null
  transmittalItems: Array<{
    id: string
    revisionNumber: number | null
    purpose: string | null
    transmittal: {
      id: string
      transmittalNumber: string
      recipientName: string
      recipientCompany: string | null
      sentAt: string | null
      status: string
      method: string
    }
  }>
}

interface DrawingDetailPanelProps {
  projectId: string
  drawingId: string
  onClose: () => void
  onEdit: () => void
  onNewRevision: () => void
  onCreateTransmittal: () => void
  onLinkCadSource?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch drawing details')
    return res.json()
  })

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'ACTIVE':
      return { bg: 'bg-green-50', text: 'text-green-700', label: 'Active' }
    case 'SUPERSEDED':
      return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Superseded' }
    case 'DRAFT':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Draft' }
    case 'ARCHIVED':
      return { bg: 'bg-red-50', text: 'text-red-600', label: 'Archived' }
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-600', label: status }
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-5">
      <div className="space-y-2">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="flex gap-2 mt-2">
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
      <div className="h-20 bg-gray-100 rounded-lg" />
      <div className="space-y-3">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrawingDetailPanel({
  projectId,
  drawingId,
  onClose,
  onEdit,
  onNewRevision,
  onCreateTransmittal,
  onLinkCadSource,
}: DrawingDetailPanelProps) {
  const { data, isLoading, mutate } = useSWR<DrawingDetail>(
    `/api/projects/${projectId}/project-files-v2/drawings/${drawingId}`,
    fetcher
  )
  const [cadActionLoading, setCadActionLoading] = useState(false)

  const handleCadAction = async (action: 'dismiss' | 'needs-replot' | 'mark-plotted') => {
    if (!data) return
    setCadActionLoading(true)
    try {
      await fetch(
        `/api/projects/${projectId}/project-files-v2/drawings/${drawingId}/cad-source/${action}`,
        { method: 'POST' }
      )
      mutate()
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      setCadActionLoading(false)
    }
  }

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent body scroll while panel is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const drawing = data
  const discipline = drawing?.discipline ? DISCIPLINE_CONFIG[drawing.discipline] : null
  const statusStyle = drawing ? getStatusStyle(drawing.status) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-white shadow-2xl',
          'flex flex-col',
          'animate-in slide-in-from-right duration-300'
        )}
      >
        {/* ── Header (sticky) ── */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-3">
              {isLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-5 w-24 bg-gray-200 rounded" />
                  <div className="h-6 w-48 bg-gray-200 rounded" />
                </div>
              ) : drawing ? (
                <>
                  <p className="text-sm font-mono font-semibold text-gray-500">
                    {drawing.drawingNumber}
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900 truncate mt-0.5">
                    {drawing.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    {discipline && (
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          discipline.bgColor,
                          discipline.textColor
                        )}
                      >
                        {discipline.shortLabel}
                      </span>
                    )}
                    {statusStyle && (
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          statusStyle.bg,
                          statusStyle.text
                        )}
                      >
                        {statusStyle.label}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Rev {drawing.currentRevision}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <DetailSkeleton />
          ) : drawing ? (
            <div className="divide-y divide-gray-100">
              {/* Quick Info Grid */}
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Floor"
                    value={drawing.floor?.shortName || drawing.floor?.name || 'N/A'}
                  />
                  <InfoCard
                    icon={<Layers className="w-3.5 h-3.5" />}
                    label="Type"
                    value={drawing.drawingType ? (DRAWING_TYPE_LABELS[drawing.drawingType] || drawing.drawingType) : 'N/A'}
                  />
                  <InfoCard
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Scale"
                    value={drawing.scale || 'N/A'}
                  />
                  <InfoCard
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Paper Size"
                    value={drawing.paperSize || 'N/A'}
                  />
                </div>
              </div>

              {/* Description (if exists) */}
              {drawing.description && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                    Description
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {drawing.description}
                  </p>
                </div>
              )}

              {/* CAD File Link */}
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  CAD File
                </p>
                {drawing.fileName || drawing.dropboxPath ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {drawing.fileName || drawing.dropboxPath?.split('/').pop() || 'CAD File'}
                      </p>
                      {drawing.fileSize && (
                        <p className="text-xs text-gray-500">
                          {formatFileSize(drawing.fileSize)}
                        </p>
                      )}
                    </div>
                    {drawing.dropboxUrl && (
                      <a
                        href={drawing.dropboxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Open
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No file linked</p>
                )}
              </div>

              {/* CAD Source Tracking */}
              {!drawing.cadSourceLink && onLinkCadSource && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    CAD Source Tracking
                  </p>
                  <button
                    onClick={onLinkCadSource}
                    className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Link2 className="w-4 h-4" />
                    Link to Source CAD File
                  </button>
                </div>
              )}
              {drawing.cadSourceLink && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      CAD Source Tracking
                    </p>
                    {onLinkCadSource && (
                      <button
                        onClick={onLinkCadSource}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">
                          {drawing.cadSourceLink.cadDropboxPath.split('/').pop() || 'CAD File'}
                        </span>
                      </div>
                      <CadFreshnessBadge status={drawing.cadSourceLink.cadFreshnessStatus} />
                    </div>
                    {drawing.cadSourceLink.cadLayoutName && (
                      <p className="text-xs text-gray-500">
                        Layout: {drawing.cadSourceLink.cadLayoutName}
                      </p>
                    )}
                    {drawing.cadSourceLink.plottedAt && (
                      <p className="text-xs text-gray-400">
                        Last plotted: {formatDate(drawing.cadSourceLink.plottedAt)}
                      </p>
                    )}

                    {/* Action buttons for CAD_MODIFIED status */}
                    {drawing.cadSourceLink.cadFreshnessStatus === 'CAD_MODIFIED' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={cadActionLoading}
                          onClick={() => handleCadAction('dismiss')}
                        >
                          Still Valid
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                          disabled={cadActionLoading}
                          onClick={() => handleCadAction('needs-replot')}
                        >
                          Needs Re-plot
                        </Button>
                      </div>
                    )}

                    {/* Action button for NEEDS_REPLOT status */}
                    {drawing.cadSourceLink.cadFreshnessStatus === 'NEEDS_REPLOT' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={cadActionLoading}
                          onClick={() => handleCadAction('mark-plotted')}
                        >
                          Mark as Plotted
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Revision History */}
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Revision History
                </p>
                {drawing.revisions.length > 0 ? (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    {drawing.revisions.length > 1 && (
                      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-gray-200" />
                    )}
                    <div className="space-y-0">
                      {drawing.revisions
                        .sort((a, b) => b.revisionNumber - a.revisionNumber)
                        .map((rev, idx) => {
                          const isLatest = idx === 0
                          return (
                            <div key={rev.id} className="relative flex gap-3 pb-4 last:pb-0">
                              {/* Timeline dot */}
                              <div className="flex-shrink-0 relative z-10 mt-1">
                                {isLatest ? (
                                  <div className="w-[15px] h-[15px] rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                                ) : (
                                  <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-300 bg-white" />
                                )}
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span
                                    className={cn(
                                      'text-sm font-semibold',
                                      isLatest ? 'text-blue-600' : 'text-gray-700'
                                    )}
                                  >
                                    Rev {rev.revisionNumber}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {formatDate(rev.issuedDate)}
                                  </span>
                                </div>
                                {rev.description && (
                                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">
                                    {rev.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                                  <User className="w-3 h-3" />
                                  <span>{rev.issuedByUser.name || 'Unknown'}</span>
                                </div>
                                {(rev.fileName || rev.dropboxUrl) && (
                                  <div className="flex items-center gap-1 mt-1">
                                    {rev.dropboxUrl ? (
                                      <a
                                        href={rev.dropboxUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                      >
                                        <FileText className="w-3 h-3" />
                                        {rev.fileName || 'View file'}
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    ) : rev.fileName ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                        <FileText className="w-3 h-3" />
                                        {rev.fileName}
                                      </span>
                                    ) : null}
                                    {rev.fileSize && (
                                      <span className="text-xs text-gray-400">
                                        ({formatFileSize(rev.fileSize)})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No revisions yet</p>
                )}
              </div>

              {/* Transmittal History */}
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Transmittal History
                </p>
                {drawing.transmittalItems.length > 0 ? (
                  <div className="space-y-3">
                    {drawing.transmittalItems.map((item) => {
                      const t = item.transmittal
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Send className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900">
                                  {t.transmittalNumber}
                                </span>
                                <span className="text-xs text-gray-400 mx-0.5">&rarr;</span>
                                <span className="text-sm text-gray-700 truncate">
                                  {t.recipientCompany || t.recipientName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {item.revisionNumber != null && (
                                  <span className="text-xs text-gray-500">
                                    Rev {item.revisionNumber}
                                  </span>
                                )}
                                {item.purpose && (
                                  <>
                                    <span className="text-xs text-gray-300">&middot;</span>
                                    <span className="text-xs text-gray-500">
                                      {item.purpose}
                                    </span>
                                  </>
                                )}
                                <span className="text-xs text-gray-300">&middot;</span>
                                <TransmittalStatusBadge status={t.status} />
                              </div>
                            </div>
                          </div>
                          {t.sentAt && (
                            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(t.sentAt)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No transmittals sent</p>
                )}
              </div>

              {/* Metadata footer */}
              <div className="px-5 py-3">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Created by {drawing.creator.name || 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(drawing.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Drawing not found
            </div>
          )}
        </div>

        {/* ── Action Bar (sticky bottom) ── */}
        {!isLoading && drawing && (
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onEdit}
              >
                <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onNewRevision}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Revision
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={onCreateTransmittal}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Transmit
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex-shrink-0 text-gray-400 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-800 truncate mt-0.5">
          {value}
        </p>
      </div>
    </div>
  )
}

function TransmittalStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    SENT: { bg: 'bg-green-50', text: 'text-green-700', label: 'Sent' },
    DRAFT: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Draft' },
    RECEIVED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Received' },
    VOID: { bg: 'bg-red-50', text: 'text-red-600', label: 'Void' },
  }
  const s = config[status] || { bg: 'bg-gray-50', text: 'text-gray-600', label: status }

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
        s.bg,
        s.text
      )}
    >
      {s.label}
    </span>
  )
}
