'use client'

import { getInitials, getTradeConfig } from './v3-constants'

interface RecipientAvatarProps {
  name: string
  trade?: string | null
  type?: string
  size?: 'sm' | 'md' | 'lg'
}

export function RecipientAvatar({ name, trade, type, size = 'md' }: RecipientAvatarProps) {
  const initials = getInitials(name)
  const tradeConfig = getTradeConfig(trade ?? null)

  const sizeClasses = {
    sm: 'h-6 w-6 text-[9px]',
    md: 'h-8 w-8 text-[10px]',
    lg: 'h-10 w-10 text-xs',
  }[size]

  const ringColor = type === 'CLIENT'
    ? 'ring-violet-400'
    : tradeConfig
      ? `ring-2 ${tradeConfig.textColor.replace('text-', 'ring-')}`
      : 'ring-gray-300'

  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center font-semibold bg-gray-100 text-gray-600 ring-2 ${ringColor} shrink-0`}
      title={name}
    >
      {initials}
    </div>
  )
}
