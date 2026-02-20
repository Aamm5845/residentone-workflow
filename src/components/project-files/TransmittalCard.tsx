'use client'

import { Mail, Truck, Globe, Package, ClipboardList, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    drawing: { id: string; drawingNumber: string; title: string; discipline: string | null }
    revision: { id: string; revisionNumber: number } | null
    [key: string]: any
  }>
}

interface TransmittalCardProps {
  transmittal: TransmittalData
  onViewDetail: (transmittal: TransmittalData) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  SENT: { label: 'Sent', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-blue-700', bg: 'bg-blue-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50' },
}

const METHOD_ICON: Record<string, any> = {
  EMAIL: Mail,
  HAND_DELIVERY: Package,
  COURIER: Truck,
  FTP: Globe,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTransmittalNumber(num: string): string {
  if (num.startsWith('T-')) return num
  const n = parseInt(num, 10)
  if (!isNaN(n)) return `T-${String(n).padStart(3, '0')}`
  return num
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TransmittalCard({ transmittal, onViewDetail }: TransmittalCardProps) {
  const status = STATUS_STYLE[transmittal.status]
  const MethodIcon = METHOD_ICON[transmittal.method] || ClipboardList
  const drawingCount = transmittal.items.length
  const sentDate = transmittal.sentAt || transmittal.createdAt

  return (
    <div
      onClick={() => onViewDetail(transmittal)}
      className="group rounded-lg border border-gray-100 bg-white p-4
        hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
    >
      {/* Line 1: number + subject + method + status + time */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-mono text-xs font-bold text-gray-400 shrink-0">
            {formatTransmittalNumber(transmittal.transmittalNumber)}
          </span>
          <span className="text-sm font-medium text-gray-900 truncate">
            {transmittal.subject || 'No subject'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Method */}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MethodIcon className="w-3.5 h-3.5" />
            {transmittal.method === 'EMAIL' ? 'Email' : 'Manual'}
          </span>

          {/* Status */}
          {status && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
              status.bg, status.color
            )}>
              {status.label}
            </span>
          )}

          {/* Time */}
          <span className="text-xs text-gray-400 tabular-nums">
            {formatTime(sentDate)}
          </span>

          {/* Chevron */}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>

      {/* Line 2: recipient + drawing count */}
      <div className="flex items-center gap-3 mt-1.5 pl-[calc(3ch+0.75rem+0.75rem)]">
        <span className="text-xs text-gray-500">
          To: <span className="text-gray-700">{transmittal.recipientName}</span>
          {transmittal.recipientCompany && (
            <>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-gray-400">{transmittal.recipientCompany}</span>
            </>
          )}
        </span>
        <span className="text-xs text-gray-400">
          {drawingCount} drawing{drawingCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

export type { TransmittalData }
