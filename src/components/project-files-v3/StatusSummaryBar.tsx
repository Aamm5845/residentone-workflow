'use client'

import { FileText, Send, AlertTriangle } from 'lucide-react'
import type { V3Drawing } from './v3-types'

interface StatusSummaryBarProps {
  drawings: V3Drawing[]
}

export function StatusSummaryBar({ drawings }: StatusSummaryBarProps) {
  const totalDrawings = drawings.length
  const totalSent = drawings.filter((d) => d.recipientCount > 0).length
  const outdatedCount = drawings.reduce((sum, d) => sum + d.outdatedRecipientCount, 0)

  return (
    <div className="flex items-center gap-6 text-sm text-gray-500">
      <div className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" />
        <span>
          <span className="font-semibold text-gray-900">{totalDrawings}</span> drawing{totalDrawings !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Send className="h-3.5 w-3.5" />
        <span>
          <span className="font-semibold text-gray-900">{totalSent}</span> sent
        </span>
      </div>
      {outdatedCount > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            <span className="font-semibold">{outdatedCount}</span> outdated
          </span>
        </div>
      )}
    </div>
  )
}
