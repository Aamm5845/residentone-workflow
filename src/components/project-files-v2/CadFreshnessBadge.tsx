'use client'

import { cn } from '@/lib/utils'
import { Check, AlertTriangle, Eye, RefreshCw, HelpCircle } from 'lucide-react'

export type CadFreshnessStatusType =
  | 'UP_TO_DATE'
  | 'CAD_MODIFIED'
  | 'DISMISSED'
  | 'NEEDS_REPLOT'
  | 'UNKNOWN'

interface CadFreshnessBadgeProps {
  status: CadFreshnessStatusType
  compact?: boolean
  className?: string
}

const FRESHNESS_CONFIG: Record<
  CadFreshnessStatusType,
  {
    label: string
    compactLabel: string
    icon: typeof Check
    bgColor: string
    textColor: string
    borderColor: string
  }
> = {
  UP_TO_DATE: {
    label: 'Current',
    compactLabel: 'Current',
    icon: Check,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
  },
  CAD_MODIFIED: {
    label: 'CAD Modified',
    compactLabel: 'Modified',
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  DISMISSED: {
    label: 'Reviewed',
    compactLabel: 'Reviewed',
    icon: Eye,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
  },
  NEEDS_REPLOT: {
    label: 'Needs Re-plot',
    compactLabel: 'Re-plot',
    icon: RefreshCw,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  },
  UNKNOWN: {
    label: 'Not Tracked',
    compactLabel: 'N/A',
    icon: HelpCircle,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-200 border-dashed',
  },
}

export default function CadFreshnessBadge({
  status,
  compact = false,
  className,
}: CadFreshnessBadgeProps) {
  const config = FRESHNESS_CONFIG[status]
  if (!config) return null

  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border text-xs font-medium',
        compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      title={config.label}
    >
      <Icon className={cn(compact ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      {!compact && <span>{config.label}</span>}
    </span>
  )
}

export { FRESHNESS_CONFIG }
