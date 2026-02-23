'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface UnresolvedCount {
  unresolvedCount: number
  highPriorityCount: number
}

interface IssueNotificationProps {
  onReportIssue?: () => void
}

export function IssueNotification({ onReportIssue }: IssueNotificationProps) {
  const [counts, setCounts] = useState<UnresolvedCount>({ unresolvedCount: 0, highPriorityCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchUnresolvedCount = async () => {
    try {
      const response = await fetch('/api/issues/unresolved-count')
      if (response.ok) {
        const data = await response.json()
        setCounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch unresolved issues count:', error)
      setCounts({ unresolvedCount: 0, highPriorityCount: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUnresolvedCount()
    const interval = setInterval(fetchUnresolvedCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const hasUnresolved = !isLoading && counts.unresolvedCount > 0
  const hasHighPriority = counts.highPriorityCount > 0

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors touch-target',
          'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
        )}
        title="Issues"
      >
        <AlertCircle className="w-5 h-5" />
        {hasUnresolved && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-stone-50',
            hasHighPriority
              ? 'bg-red-500 text-white'
              : 'bg-orange-400 text-white'
          )}>
            {counts.unresolvedCount > 9 ? '9+' : counts.unresolvedCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50">
          <button
            onClick={() => {
              setDropdownOpen(false)
              onReportIssue?.()
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <Plus className="w-4 h-4 text-stone-400" />
            Report Issue
          </button>
          {hasUnresolved && (
            <Link
              href="/preferences?tab=issues"
              onClick={() => setDropdownOpen(false)}
              className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-stone-400" />
                View Issues
              </div>
              <span className={cn(
                'text-[11px] font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                hasHighPriority
                  ? 'bg-red-50 text-red-600'
                  : 'bg-orange-50 text-orange-600'
              )}>
                {counts.unresolvedCount}
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default IssueNotification
