'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Loader2,
  Send,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { RecipientAvatar } from './RecipientAvatar'
import { DisciplineBadge } from './DisciplineBadge'
import { formatDateTime, formatFileSize, getRelativeDate } from './v3-constants'
import type { V3TimelineEvent } from './v3-types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ActivityFeedProps {
  projectId: string
  onRecipientClick: (email: string) => void
}

export function ActivityFeed({ projectId, onRecipientClick }: ActivityFeedProps) {
  const { data, isLoading } = useSWR<{ events: V3TimelineEvent[]; total: number }>(
    `/api/projects/${projectId}/project-files-v3/timeline`,
    fetcher
  )

  // Group events by date
  const grouped = useMemo(() => {
    if (!data?.events) return []
    const groups = new Map<string, V3TimelineEvent[]>()

    for (const event of data.events) {
      const date = new Date(event.sentAt)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!groups.has(dateKey)) groups.set(dateKey, [])
      groups.get(dateKey)!.push(event)
    }

    return Array.from(groups.entries()).map(([key, events]) => ({
      dateKey: key,
      label: getRelativeDate(events[0].sentAt),
      events,
    }))
  }, [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data?.events?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Clock className="h-12 w-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">No activity yet</p>
        <p className="text-sm mt-1">Send drawings or files to see activity here</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {grouped.map((group) => (
        <div key={group.dateKey}>
          {/* Date header */}
          <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {group.label}
          </div>

          <div className="space-y-4">
            {group.events.map((event) => (
              <ActivityCard
                key={event.id}
                event={event}
                onRecipientClick={onRecipientClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityCard({
  event,
  onRecipientClick,
}: {
  event: V3TimelineEvent
  onRecipientClick: (email: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isTransmittal = event.type === 'transmittal'
  const itemCount = event.items?.length || 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
            isTransmittal ? 'bg-blue-50' : 'bg-violet-50'
          }`}
        >
          {isTransmittal ? (
            <Send className="h-4 w-4 text-blue-600" />
          ) : (
            <FileText className="h-4 w-4 text-violet-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">
            <span className="font-medium">{event.sentByName}</span>
            {' sent '}
            {isTransmittal ? (
              <>
                <span className="font-medium">{itemCount} drawing{itemCount !== 1 ? 's' : ''}</span>
                {' to '}
              </>
            ) : (
              <>
                <span className="font-medium">{event.fileName}</span>
                {' to '}
              </>
            )}
            <button
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              onClick={() => event.recipientEmail && onRecipientClick(event.recipientEmail)}
            >
              {event.recipientName}
            </button>
            {event.recipientCompany && (
              <span className="text-gray-400"> · {event.recipientCompany}</span>
            )}
          </p>

          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{formatDateTime(event.sentAt)}</span>
            {event.transmittalNumber && <span>{event.transmittalNumber}</span>}
            {event.subject && <span className="truncate">{event.subject}</span>}
            {!isTransmittal && event.fileSize && (
              <span>{formatFileSize(event.fileSize)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable items (for transmittals) */}
      {isTransmittal && itemCount > 0 && (
        <div className="mt-2 ml-12">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {itemCount} drawing{itemCount !== 1 ? 's' : ''}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5">
              {event.items!.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-2 px-2.5 rounded-lg bg-gray-50"
                >
                  <span className="font-mono font-semibold text-gray-700">
                    {item.drawingNumber}
                  </span>
                  <span className="text-gray-500 truncate flex-1">{item.title}</span>
                  {item.discipline && <DisciplineBadge discipline={item.discipline} />}
                  {item.revisionNumber != null && (
                    <span className="text-xs text-gray-400 font-medium">
                      Rev {item.revisionNumber}
                    </span>
                  )}
                  {item.purpose && (
                    <span className="text-xs text-gray-400">
                      {item.purpose.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
