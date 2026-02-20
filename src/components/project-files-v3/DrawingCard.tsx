'use client'

import { useState } from 'react'
import { Send, MoreHorizontal, Check, AlertTriangle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DisciplineBadge } from './DisciplineBadge'
import { QuickSendPopover } from './QuickSendPopover'
import { getDisciplineConfig, STATUS_CONFIG, formatDate } from './v3-constants'
import type { V3Drawing, V3Recipient } from './v3-types'

interface DrawingCardProps {
  drawing: V3Drawing
  recipients: V3Recipient[]
  projectId: string
  isSelected: boolean
  onSelect: (id: string) => void
  onClick: (id: string) => void
  onSent: () => void
}

export function DrawingCard({
  drawing,
  recipients,
  projectId,
  isSelected,
  onSelect,
  onClick,
  onSent,
}: DrawingCardProps) {
  const [hovered, setHovered] = useState(false)
  const disciplineConfig = getDisciplineConfig(drawing.discipline)
  const statusConfig = STATUS_CONFIG[drawing.status]

  const thumbnailUrl = `/api/projects/${projectId}/project-files-v2/pdf-thumbnail?path=${encodeURIComponent(drawing.dropboxPath || '')}`

  return (
    <div
      className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(drawing.id)}
    >
      {/* Discipline color stripe */}
      <div
        className="h-1"
        style={{ backgroundColor: disciplineConfig?.hex || '#9CA3AF' }}
      />

      {/* Select checkbox on hover */}
      {(hovered || isSelected) && (
        <button
          className={`absolute top-3 left-3 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white/90 border-gray-300 hover:border-blue-500'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(drawing.id)
          }}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </button>
      )}

      {/* Menu */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-6 w-6 rounded-md bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onClick(drawing.id)}>View Details</DropdownMenuItem>
            <DropdownMenuItem>New Revision</DropdownMenuItem>
            {drawing.dropboxPath && (
              <DropdownMenuItem>Open in Dropbox</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
        {drawing.dropboxPath ? (
          <img
            src={thumbnailUrl}
            alt={drawing.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* Drawing number + discipline */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900 font-mono">
            {drawing.drawingNumber}
          </span>
          <DisciplineBadge discipline={drawing.discipline} />
        </div>

        {/* Title */}
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed min-h-[2rem]">
          {drawing.title}
        </p>

        {/* Rev + Status */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
            Rev {drawing.currentRevision}
          </span>
          {statusConfig && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
              {statusConfig.label}
            </span>
          )}
        </div>

        {/* Distribution summary */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {drawing.recipientCount > 0 ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-gray-600">
                {drawing.recipientCount} received
              </span>
              {drawing.outdatedRecipientCount > 0 && (
                <>
                  <span className="text-gray-300 mx-0.5">·</span>
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="text-amber-600">{drawing.outdatedRecipientCount} outdated</span>
                </>
              )}
            </>
          ) : (
            <>
              <Circle className="h-3 w-3 text-gray-300" />
              <span className="text-gray-400">Not sent yet</span>
            </>
          )}
        </div>

        {/* Last sent */}
        {drawing.lastTransmittal && (
          <div className="text-[10px] text-gray-400 truncate">
            Last sent to {drawing.lastTransmittal.recipientName} · {formatDate(drawing.lastTransmittal.sentAt)}
          </div>
        )}

        {/* Quick Send button */}
        <div className="pt-1">
          <QuickSendPopover
            drawing={drawing}
            recipients={recipients}
            projectId={projectId}
            onSent={onSent}
          >
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Send className="h-3 w-3" />
              Send
            </Button>
          </QuickSendPopover>
        </div>
      </div>
    </div>
  )
}
