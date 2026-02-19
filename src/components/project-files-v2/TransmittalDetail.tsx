'use client'

import {
  X,
  Mail,
  Send,
  Download,
  User,
  Building2,
  Calendar,
  FileText,
  Truck,
  Globe,
  ClipboardList,
  Package,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Shared config ──────────────────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, { bgColor: string; textColor: string }> = {
  ARCHITECTURAL: { bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  ELECTRICAL: { bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  RCP: { bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  PLUMBING: { bgColor: 'bg-green-50', textColor: 'text-green-700' },
  MECHANICAL: { bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  INTERIOR_DESIGN: { bgColor: 'bg-pink-50', textColor: 'text-pink-700' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SENT: { label: 'Sent', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-50' },
}

const METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  HAND_DELIVERY: 'Hand Delivery',
  COURIER: 'Courier',
  FTP: 'FTP',
  OTHER: 'Other',
}

// ─── Types ──────────────────────────────────────────────────────────────────

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
  createdAt: string
  creator: { id: string; name: string | null }
  sentByUser: { id: string; name: string | null } | null
  items: Array<{
    id: string
    revisionNumber: number | null
    purpose: string | null
    notes: string | null
    drawing: {
      id: string
      drawingNumber: string
      title: string
      discipline: string | null
    }
    revision: {
      id: string
      revisionNumber: number
      description: string | null
    } | null
  }>
}

interface TransmittalDetailProps {
  transmittal: TransmittalData
  onClose: () => void
  onResend: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTransmittalNumber(num: string): string {
  if (num.startsWith('T-')) return num
  const n = parseInt(num, 10)
  if (!isNaN(n)) return `T-${String(n).padStart(3, '0')}`
  return num
}

function getMethodIcon(method: string) {
  switch (method) {
    case 'EMAIL':
      return <Mail className="h-4 w-4" />
    case 'HAND_DELIVERY':
      return <Package className="h-4 w-4" />
    case 'COURIER':
      return <Truck className="h-4 w-4" />
    case 'FTP':
      return <Globe className="h-4 w-4" />
    default:
      return <ClipboardList className="h-4 w-4" />
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TransmittalDetail({
  transmittal,
  onClose,
  onResend,
}: TransmittalDetailProps) {
  const status = STATUS_CONFIG[transmittal.status]
  const canResend = transmittal.status === 'SENT' && transmittal.method === 'EMAIL'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* ── Header ──────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold text-gray-900 font-mono">
                  {formatTransmittalNumber(transmittal.transmittalNumber)}
                </DialogTitle>
                {status && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      status.bgColor,
                      status.color
                    )}
                  >
                    {status.label}
                  </span>
                )}
              </div>
              {transmittal.subject && (
                <DialogDescription className="text-sm text-gray-600">
                  {transmittal.subject}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Recipient & meta info */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {/* Recipient */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Recipient
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900">{transmittal.recipientName}</span>
                  </div>
                  {transmittal.recipientEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                      <a
                        href={`mailto:${transmittal.recipientEmail}`}
                        className="text-blue-600 hover:underline"
                      >
                        {transmittal.recipientEmail}
                      </a>
                    </div>
                  )}
                  {transmittal.recipientCompany && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-700">{transmittal.recipientCompany}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Delivery
                </h4>
                <div className="space-y-2">
                  {/* Method */}
                  <div className="flex items-center gap-2 text-sm">
                    {getMethodIcon(transmittal.method)}
                    <span className="text-gray-700">
                      {METHOD_LABELS[transmittal.method] ?? transmittal.method}
                    </span>
                  </div>

                  {/* Sent date */}
                  {transmittal.sentAt ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-700">
                        Sent {formatDateTime(transmittal.sentAt)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-400 italic">Not yet sent</span>
                    </div>
                  )}

                  {/* Sent by */}
                  {transmittal.sentByUser && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-500">
                        by {transmittal.sentByUser.name || 'Unknown'}
                      </span>
                    </div>
                  )}

                  {/* Created date */}
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-500">
                      Created {formatDate(transmittal.createdAt)}
                      {transmittal.creator?.name && ` by ${transmittal.creator.name}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Drawings table ────────────────────────────────────── */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Drawings ({transmittal.items.length})
            </h4>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[110px]">
                      Drawing #
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Title
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[120px]">
                      Discipline
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[80px]">
                      Revision
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[130px]">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transmittal.items.map((item) => {
                    const disc = item.drawing.discipline ? DISCIPLINE_COLORS[item.drawing.discipline] : null
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-bold text-gray-800 text-xs">
                            {item.drawing.drawingNumber}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-gray-900">{item.drawing.title}</span>
                            {item.notes && (
                              <span className="text-xs text-gray-400 mt-0.5 italic">
                                {item.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {disc && item.drawing.discipline ? (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                                disc.bgColor,
                                disc.textColor
                              )}
                            >
                              {item.drawing.discipline.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {item.revision ? (
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                              Rev {item.revision.revisionNumber}
                            </span>
                          ) : item.revisionNumber != null ? (
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                              Rev {item.revisionNumber}
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {item.purpose ? (
                            <span className="text-sm text-gray-700">{item.purpose}</span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Notes ─────────────────────────────────────────────── */}
          {transmittal.notes && (
            <div className="px-6 py-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Notes
              </h4>
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{transmittal.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50/50 px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-1.5" />
              Download Cover Sheet
            </Button>
            {canResend && (
              <Button onClick={onResend}>
                <Send className="h-4 w-4 mr-1.5" />
                Resend
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
