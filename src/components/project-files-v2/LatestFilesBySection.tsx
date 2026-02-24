'use client'

import { useMemo } from 'react'
import { Send, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionData {
  id: string
  name: string
  shortName: string
  color: string
}

interface TransmittalData {
  id: string
  transmittalNumber: string
  subject: string | null
  recipientName: string
  recipientEmail: string | null
  recipientCompany: string | null
  recipientType: string | null
  method: string
  status: string
  notes: string | null
  sentAt: string | null
  emailOpenedAt: string | null
  createdAt: string
  creator: { id: string; name: string | null }
  sentByUser: { id: string; name: string | null } | null
  items: Array<{
    id: string
    revisionNumber: number | null
    purpose: string | null
    notes: string | null
    fileName?: string | null
    title?: string | null
    sectionId?: string | null
    reviewNo?: string | null
    pageNo?: string | null
    section?: SectionData | null
    dropboxPath?: string | null
    drawing: {
      id: string
      drawingNumber: string
      title: string
      section: SectionData | null
      dropboxPath: string | null
      dropboxUrl: string | null
      fileName: string | null
      pageNo: string | null
      reviewNo: string | null
    } | null
    revision: {
      id: string
      revisionNumber: number
      description: string | null
      dropboxPath: string | null
      dropboxUrl: string | null
      fileName: string | null
    } | null
  }>
}

interface LatestSentFile {
  key: string
  title: string
  drawingNumber: string
  pageNo: string | null
  reviewNo: string | null
  revisionNumber: number | null
  section: SectionData | null
  recipientName: string
  recipientCompany: string | null
  sentAt: string | null
  method: string
  dropboxPath: string | null
}

interface SectionGroup {
  section: SectionData | null
  files: LatestSentFile[]
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLatestFilesBySection(transmittals: TransmittalData[]): SectionGroup[] {
  return useMemo(() => {
    const latestMap = new Map<string, LatestSentFile>()

    for (const t of transmittals) {
      // Skip drafts — only include actually sent transmittals
      if (!t.sentAt) continue

      for (const item of t.items) {
        const sec = item.section || item.drawing?.section
        const sectionId = sec?.id || '__none__'
        const pageNo = item.pageNo || item.drawing?.pageNo
        const fileId = pageNo
          ? `page::${pageNo}`
          : item.drawing?.id
            ? `drawing::${item.drawing.id}`
            : `file::${item.fileName || item.id}`
        const key = `${sectionId}::${fileId}`

        const revNum = item.revision?.revisionNumber ?? item.revisionNumber ?? 0
        const candidate: LatestSentFile = {
          key,
          title: item.title || item.drawing?.title || item.fileName || 'Untitled',
          drawingNumber: item.drawing?.drawingNumber || '',
          pageNo: pageNo || null,
          reviewNo: item.reviewNo || item.drawing?.reviewNo || null,
          revisionNumber: item.revision?.revisionNumber ?? item.revisionNumber ?? null,
          section: sec || null,
          recipientName: t.recipientName,
          recipientCompany: t.recipientCompany,
          sentAt: t.sentAt,
          method: t.method,
          dropboxPath: item.dropboxPath || item.revision?.dropboxPath || item.drawing?.dropboxPath || null,
        }

        const existing = latestMap.get(key)
        if (!existing) {
          latestMap.set(key, candidate)
          continue
        }

        // Keep the most recently sent; tie-break by higher revision
        const existingTime = existing.sentAt ? new Date(existing.sentAt).getTime() : 0
        const candidateTime = t.sentAt ? new Date(t.sentAt).getTime() : 0

        if (candidateTime > existingTime) {
          latestMap.set(key, candidate)
        } else if (candidateTime === existingTime) {
          const existingRev = existing.revisionNumber ?? 0
          if (revNum > existingRev) {
            latestMap.set(key, candidate)
          }
        }
      }
    }

    // Group by section
    const groupMap = new Map<string, SectionGroup>()
    for (const file of latestMap.values()) {
      const groupKey = file.section?.id || '__none__'
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { section: file.section, files: [] })
      }
      groupMap.get(groupKey)!.files.push(file)
    }

    // Sort groups: named sections alphabetically, "Uncategorized" last
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (!a.section && b.section) return 1
      if (a.section && !b.section) return -1
      if (!a.section || !b.section) return 0
      return a.section.name.localeCompare(b.section.name)
    })

    // Sort files within each section by pageNo
    for (const group of groups) {
      group.files.sort((a, b) => {
        if (!a.pageNo && b.pageNo) return 1
        if (a.pageNo && !b.pageNo) return -1
        if (a.pageNo && b.pageNo) return a.pageNo.localeCompare(b.pageNo, undefined, { numeric: true })
        return a.title.localeCompare(b.title)
      })
    }

    return groups
  }, [transmittals])
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

interface LatestFilesBySectionProps {
  sectionGroups: SectionGroup[]
  onOpenInFiles?: (folderPath: string) => void
}

export default function LatestFilesBySection({ sectionGroups, onOpenInFiles }: LatestFilesBySectionProps) {
  const totalFiles = sectionGroups.reduce((sum, g) => sum + g.files.length, 0)

  // Empty state
  if (sectionGroups.length === 0) {
    return (
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Summary</div>
            <div className="text-sm font-semibold text-slate-900">Latest by Section</div>
          </div>
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <Send className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">No files sent yet</p>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Panel header */}
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Summary</div>
          <div className="text-sm font-semibold text-slate-900">Latest by Section</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {totalFiles} file{totalFiles !== 1 ? 's' : ''} across {sectionGroups.length} section{sectionGroups.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          {sectionGroups.map((group) => (
            <div key={group.section?.id || '__none__'} className="border-b border-slate-100 last:border-b-0">
              {/* Section header — sticky within scroll */}
              <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-4 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  {group.section ? (
                    <>
                      <span className={cn('h-2 w-2 rounded-full shrink-0', group.section.color || 'bg-slate-400')} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{group.section.name}</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">Uncategorized</span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                    {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Files within section */}
              <div className="divide-y divide-slate-50">
                {group.files.map((file) => (
                  <div key={file.key} className="group px-4 py-2.5 hover:bg-slate-50/70 transition-colors">
                    {/* Title + pageNo + open button */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium text-slate-900 truncate leading-tight">
                        {file.title}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {file.dropboxPath && onOpenInFiles && (
                          <button
                            onClick={() => {
                              const parts = file.dropboxPath!.split('/')
                              parts.pop()
                              onOpenInFiles(parts.join('/'))
                            }}
                            className="hidden group-hover:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Open in All Files"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            Open
                          </button>
                        )}
                        {file.pageNo && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 whitespace-nowrap">
                            #{file.pageNo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta: Rev · Recipient · Date */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                      {(file.reviewNo || file.revisionNumber != null) && (
                        <>
                          <span className="font-medium text-slate-600">
                            Rev {file.reviewNo || file.revisionNumber}
                          </span>
                          <span className="text-slate-300">&middot;</span>
                        </>
                      )}
                      <span className="truncate max-w-[120px]">{file.recipientName}</span>
                      {file.sentAt && (
                        <>
                          <span className="text-slate-300">&middot;</span>
                          <span className="text-slate-400 shrink-0">{formatShortDate(file.sentAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
