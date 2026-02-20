'use client'

import { X, Send, ExternalLink, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DisciplineBadge } from './DisciplineBadge'
import { formatDate, STATUS_CONFIG } from './v3-constants'
import type { V3Drawing } from './v3-types'

interface DrawingDetailSheetProps {
  drawing: V3Drawing
  projectId: string
  onClose: () => void
  onSendClick: (drawingId: string) => void
}

export function DrawingDetailSheet({
  drawing,
  projectId,
  onClose,
  onSendClick,
}: DrawingDetailSheetProps) {
  const statusConfig = STATUS_CONFIG[drawing.status]
  const thumbnailUrl = `/api/projects/${projectId}/project-files-v2/pdf-thumbnail?path=${encodeURIComponent(drawing.dropboxPath || '')}`

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[420px] bg-white border-l border-gray-200 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-gray-900 font-mono">{drawing.drawingNumber}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{drawing.title}</p>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* PDF Preview */}
        {drawing.dropboxPath && (
          <div className="aspect-[4/3] bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
            <img
              src={thumbnailUrl}
              alt={drawing.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Discipline</span>
            <div className="mt-1">
              <DisciplineBadge discipline={drawing.discipline} size="md" />
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</span>
            <div className="mt-1">
              {statusConfig && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                  {statusConfig.label}
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Revision</span>
            <p className="text-sm font-semibold text-gray-900 mt-1">Rev {drawing.currentRevision}</p>
          </div>
          {drawing.floor && (
            <div>
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Floor</span>
              <p className="text-sm text-gray-700 mt-1">{drawing.floor.name}</p>
            </div>
          )}
        </div>

        {/* Revisions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Revision History
          </h4>
          <div className="space-y-1.5">
            {drawing.revisions.map((rev) => (
              <div
                key={rev.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                  rev.revisionNumber === drawing.currentRevision ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'
                }`}
              >
                <span className="font-mono font-bold text-gray-700">Rev {rev.revisionNumber}</span>
                <span className="flex-1 text-gray-500 truncate">
                  {rev.description || 'No description'}
                </span>
                <span className="text-gray-400 shrink-0">
                  {formatDate(rev.issuedDate)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution summary */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Distribution
          </h4>
          {drawing.recipientCount > 0 ? (
            <div className="text-sm text-gray-600">
              <p>Sent to <span className="font-semibold">{drawing.recipientCount}</span> recipient{drawing.recipientCount !== 1 ? 's' : ''}</p>
              {drawing.outdatedRecipientCount > 0 && (
                <p className="text-amber-600 mt-1">
                  {drawing.outdatedRecipientCount} have an older revision
                </p>
              )}
              {drawing.lastTransmittal && (
                <p className="text-gray-400 mt-1">
                  Last sent to {drawing.lastTransmittal.recipientName} on {formatDate(drawing.lastTransmittal.sentAt)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not sent to anyone yet</p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 p-4 border-t border-gray-100 flex gap-2">
        <Button
          onClick={() => onSendClick(drawing.id)}
          className="flex-1 h-9 text-sm gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          Send Drawing
        </Button>
        {drawing.dropboxPath && (
          <Button variant="outline" size="sm" className="h-9">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
