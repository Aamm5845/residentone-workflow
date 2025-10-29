'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface UnresolvedCount {
  unresolvedCount: number
  highPriorityCount: number
}

export function IssueNotification() {
  const [counts, setCounts] = useState<UnresolvedCount>({ unresolvedCount: 0, highPriorityCount: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const fetchUnresolvedCount = async () => {
    try {
      const response = await fetch('/api/issues/unresolved-count')
      if (response.ok) {
        const data = await response.json()
        setCounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch unresolved issues count:', error)
      // Set to zero on error to prevent showing stale data
      setCounts({ unresolvedCount: 0, highPriorityCount: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUnresolvedCount()
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchUnresolvedCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Don't show notification if no unresolved issues or still loading
  if (isLoading || counts.unresolvedCount === 0) {
    return null
  }

  const hasHighPriority = counts.highPriorityCount > 0

  return (
    <Link href="/preferences?tab=issues" className="relative">
      <Badge 
        variant="outline"
        className={cn(
          "flex items-center space-x-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
          hasHighPriority
            ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-200"
            : "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200"
        )}
      >
        {hasHighPriority ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <AlertCircle className="w-3 h-3" />
        )}
        <span>{counts.unresolvedCount}</span>
        {hasHighPriority && (
          <span className="text-xs opacity-75">({counts.highPriorityCount} urgent)</span>
        )}
      </Badge>
    </Link>
  )
}

export default IssueNotification
