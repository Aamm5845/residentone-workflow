'use client'

import React from 'react'
import * as LucideIcons from 'lucide-react'
import { Package } from 'lucide-react'

interface Props {
  name: string
  className?: string
  fallback?: React.ReactNode
}

/**
 * Dynamically renders a Lucide icon by name
 * Falls back to Package icon if not found
 */
export default function DynamicIcon({ name, className = 'w-5 h-5', fallback }: Props) {
  const IconComponent = (LucideIcons as any)[name]
  
  // Debug logging
  if (!IconComponent) {
    console.log('[DynamicIcon] Icon not found:', name, 'Available:', Object.keys(LucideIcons).slice(0, 10))
  }
  
  if (!IconComponent) {
    if (fallback) return <>{fallback}</>
    return <Package className={className} />
  }
  
  return <IconComponent className={className} />
}
