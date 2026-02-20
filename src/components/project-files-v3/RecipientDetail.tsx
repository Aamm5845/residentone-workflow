'use client'

import { X, Send, FileText, Loader2 } from 'lucide-react'
import useSWR from 'swr'
import { RecipientAvatar } from './RecipientAvatar'
import { DisciplineBadge } from './DisciplineBadge'
import { formatDate, formatDateTime } from './v3-constants'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface RecipientDetailProps {
  projectId: string
  recipientEmail: string
  onClose: () => void
}

export function RecipientDetail({ projectId, recipientEmail, onClose }: RecipientDetailProps) {
  const { data, isLoading } = useSWR(
    `/api/projects/${projectId}/project-files-v3/recipient-history?email=${encodeURIComponent(recipientEmail)}`,
    fetcher
  )

  const transmittals = data?.transmittals || []
  const fileSends = data?.fileSends || []

  // Merge and sort by date
  const allEvents = [
    ...transmittals.map((t: any) => ({ type: 'transmittal' as const, data: t, date: t.sentAt || t.createdAt })),
    ...fileSends.map((f: any) => ({ type: 'file_send' as const, data: f, date: f.sentAt || f.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const recipientName = transmittals[0]?.recipientName || fileSends[0]?.recipientName || recipientEmail
  const recipientCompany = transmittals[0]?.recipientCompany || fileSends[0]?.recipientCompany

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[420px] bg-white border-l border-gray-200 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <RecipientAvatar name={recipientName} size="lg" />
          <div>
            <h3 className="text-base font-bold text-gray-900">{recipientName}</h3>
            {recipientCompany && <p className="text-sm text-gray-500">{recipientCompany}</p>}
            <p className="text-xs text-gray-400">{recipientEmail}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-4 text-sm text-gray-500">
        <span><span className="font-semibold text-gray-700">{transmittals.length}</span> transmittal{transmittals.length !== 1 ? 's' : ''}</span>
        <span><span className="font-semibold text-gray-700">{fileSends.length}</span> file{fileSends.length !== 1 ? 's' : ''}</span>
        {allEvents.length > 0 && (
          <span>Last: {formatDate(allEvents[0].date)}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : allEvents.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Nothing sent to this recipient yet</p>
        ) : (
          allEvents.map((event, i) => {
            if (event.type === 'transmittal') {
              const t = event.data
              return (
                <div key={`t-${t.id}`} className="bg-gray-50 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-gray-500">{t.transmittalNumber}</span>
                    <span className="text-xs text-gray-400 ml-auto">{formatDateTime(event.date)}</span>
                  </div>
                  <div className="space-y-1">
                    {t.items?.map((item: any, j: number) => (
                      <div key={j} className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-semibold text-gray-700">{item.drawing?.drawingNumber}</span>
                        <span className="text-gray-500 truncate flex-1">{item.drawing?.title}</span>
                        {item.drawing?.discipline && <DisciplineBadge discipline={item.drawing.discipline} />}
                        <span className="text-xs text-gray-400">Rev {item.revisionNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            const f = event.data
            return (
              <div key={`f-${f.id}`} className="bg-gray-50 rounded-lg p-3.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-sm font-medium text-gray-700">{f.fileName}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDateTime(event.date)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
