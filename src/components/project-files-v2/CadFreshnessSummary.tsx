'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, RefreshCw, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CadFreshnessSummaryProps {
  projectId: string
}

interface FreshnessSummary {
  total: number
  upToDate: number
  cadModified: number
  dismissed: number
  needsReplot: number
  unknown: number
}

interface FreshnessData {
  checkedAt: string
  cadFiles: any[]
  summary: FreshnessSummary
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function CadFreshnessSummary({ projectId }: CadFreshnessSummaryProps) {
  const { data, isLoading, mutate } = useSWR<FreshnessData>(
    `/api/projects/${projectId}/project-files-v2/cad-freshness`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 } // 5 min cache
  )
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await mutate()
    setIsRefreshing(false)
  }

  if (isLoading || !data) return null

  const { summary } = data

  // Don't show widget if there are no tracked drawings
  if (summary.total === 0) return null

  // Don't show if everything is up to date or unknown
  const issues = summary.cadModified + summary.needsReplot
  if (issues === 0) {
    // Show a small green indicator
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-4">
        <Check className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700">
          All {summary.total} tracked drawing{summary.total !== 1 ? 's' : ''} up to date
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-100"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border mb-4',
      summary.needsReplot > 0
        ? 'bg-red-50 border-red-200'
        : 'bg-amber-50 border-amber-200'
    )}>
      <AlertTriangle className={cn(
        'w-5 h-5 flex-shrink-0',
        summary.needsReplot > 0 ? 'text-red-500' : 'text-amber-500'
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          summary.needsReplot > 0 ? 'text-red-800' : 'text-amber-800'
        )}>
          {issues} of {summary.total} tracked drawing{summary.total !== 1 ? 's' : ''} may need attention
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs">
          {summary.cadModified > 0 && (
            <span className="text-amber-600">
              {summary.cadModified} CAD modified
            </span>
          )}
          {summary.needsReplot > 0 && (
            <span className="text-red-600">
              {summary.needsReplot} need re-plot
            </span>
          )}
          {summary.dismissed > 0 && (
            <span className="text-gray-500">
              {summary.dismissed} reviewed
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-2 text-xs',
          summary.needsReplot > 0
            ? 'text-red-600 hover:text-red-700 hover:bg-red-100'
            : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100'
        )}
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </>
        )}
      </Button>
    </div>
  )
}
