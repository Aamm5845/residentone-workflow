'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { Loader2, Grid3X3 } from 'lucide-react'
import { RevisionIndicator, EmptyRevisionCell } from './RevisionIndicator'
import { RecipientAvatar } from './RecipientAvatar'
import { TradeBadge } from './TradeBadge'
import { DISCIPLINE_CONFIG } from './v3-constants'
import type { V3MatrixData } from './v3-types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DistributionMatrixProps {
  projectId: string
  disciplineFilter: string | null
}

export function DistributionMatrix({ projectId, disciplineFilter }: DistributionMatrixProps) {
  const { data, isLoading } = useSWR<V3MatrixData>(
    `/api/projects/${projectId}/project-files-v3/distribution-matrix`,
    fetcher
  )

  const filteredDrawings = useMemo(() => {
    if (!data) return []
    if (!disciplineFilter) return data.drawings
    return data.drawings.filter((d) => d.discipline === disciplineFilter)
  }, [data, disciplineFilter])

  // Group drawings by discipline
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filteredDrawings>()
    for (const d of filteredDrawings) {
      const key = d.discipline || '_OTHER'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(d)
    }
    return Array.from(groups.entries())
  }, [filteredDrawings])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data || data.recipients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Grid3X3 className="h-12 w-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">No distribution data yet</p>
        <p className="text-sm mt-1">Send some drawings to see the distribution matrix</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-white min-w-[180px] p-2 text-left font-medium text-gray-500 border-b-2 border-gray-200">
              Drawing
            </th>
            {data.recipients.map((r) => (
              <th
                key={r.email}
                className="p-2 text-center font-normal border-b-2 border-gray-200 min-w-[100px]"
              >
                <div className="flex flex-col items-center gap-1">
                  <RecipientAvatar name={r.name} trade={r.trade} type={r.type || undefined} size="sm" />
                  <span className="text-[10px] font-medium text-gray-700 truncate max-w-[90px]">
                    {r.name}
                  </span>
                  {r.company && (
                    <span className="text-[9px] text-gray-400 truncate max-w-[90px]">
                      {r.company}
                    </span>
                  )}
                  {r.trade && <TradeBadge trade={r.trade} size="sm" showIcon={false} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map(([discipline, drawings]) => {
            const config = DISCIPLINE_CONFIG[discipline]
            return (
              <Fragment key={discipline}>
                {/* Discipline group header */}
                <tr>
                  <td
                    colSpan={data.recipients.length + 1}
                    className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: config?.hex || '#9CA3AF' }}
                      />
                      {config?.label || 'Other'}
                    </span>
                  </td>
                </tr>
                {/* Drawing rows */}
                {drawings.map((drawing) => (
                  <tr key={drawing.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">
                          {drawing.drawingNumber}
                        </span>
                        <span className="text-gray-400 truncate max-w-[100px]">
                          {drawing.title}
                        </span>
                        <span className="ml-auto text-[10px] text-gray-400 font-medium shrink-0">
                          R{drawing.currentRevision}
                        </span>
                      </div>
                    </td>
                    {data.recipients.map((r) => {
                      const cell = data.cells?.[drawing.id]?.[r.email]
                      return (
                        <td
                          key={r.email}
                          className="p-2 text-center border-b border-gray-100"
                        >
                          {cell ? (
                            <RevisionIndicator
                              revisionNumber={cell.revisionNumber}
                              isLatest={cell.isLatest}
                            />
                          ) : (
                            <EmptyRevisionCell />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 px-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-center text-[8px] font-bold leading-[12px]">R</span>
          Has latest
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-center text-[8px] font-bold leading-[12px]">R</span>
          Outdated
        </span>
        <span className="flex items-center gap-1">
          <span className="text-gray-300">—</span>
          Never sent
        </span>
      </div>
    </div>
  )
}

// Need Fragment import
import { Fragment } from 'react'
