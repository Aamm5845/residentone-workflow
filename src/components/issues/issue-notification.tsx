'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle,
  X,
  Eye,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IssueNotificationProps {
  onViewIssues?: () => void
}

interface UnresolvedCount {
  unresolvedCount: number
  highPriorityCount: number
}

export default function IssueNotification({ onViewIssues }: IssueNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [counts, setCounts] = useState<UnresolvedCount>({ unresolvedCount: 0, highPriorityCount: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const fetchUnresolvedCount = async () => {
    try {
      const response = await fetch('/api/issues/unresolved-count')
      if (response.ok) {
        const data = await response.json()
        setCounts(data)
        setIsVisible(data.unresolvedCount > 0)
      }
    } catch (error) {
      console.error('Error fetching unresolved issue count:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUnresolvedCount()
    
    // Set up polling to check for new issues every 30 seconds
    const interval = setInterval(fetchUnresolvedCount, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
  }

  const handleViewIssues = () => {
    onViewIssues?.()
    setIsVisible(false) // Hide notification when issues are viewed
  }

  if (isLoading || !isVisible || counts.unresolvedCount === 0) {
    return null
  }

  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 bg-white border border-orange-200 rounded-lg shadow-lg p-4 max-w-sm",
      "animate-in slide-in-from-right-full duration-300"
    )}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-900">
              Unresolved Issues
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-sm text-gray-600">
                {counts.unresolvedCount} open {counts.unresolvedCount === 1 ? 'issue' : 'issues'}
              </span>
            </div>
            
            {counts.highPriorityCount > 0 && (
              <div className="flex items-center space-x-2">
                <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                  High Priority
                </Badge>
                <span className="text-sm text-gray-600">
                  {counts.highPriorityCount} urgent {counts.highPriorityCount === 1 ? 'issue' : 'issues'}
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-3 flex space-x-2">
            <Button
              size="sm"
              onClick={handleViewIssues}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Issues
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="text-gray-600 hover:text-gray-900"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}