'use client'

import { getTradeConfig } from './v3-constants'

interface TradeBadgeProps {
  trade: string | null
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export function TradeBadge({ trade, size = 'sm', showIcon = true }: TradeBadgeProps) {
  const config = getTradeConfig(trade)
  if (!config) return null

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses}`}
    >
      {showIcon && <span className="text-[10px]">{config.icon}</span>}
      {config.label}
    </span>
  )
}
