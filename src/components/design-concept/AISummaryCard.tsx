'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { 
  Sparkles, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Clock,
  Loader2,
  Edit,
  Save,
  X as XIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface AISummaryData {
  summary: string
  counts: {
    total: number
    completed: number
    pending: number
  }
  meta: {
    model: string
    generatedAt: string
    processingTimeMs: number
    itemsAnalyzed: number
    imagesAnalyzed: number
  }
}

interface Props {
  stageId: string
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    return res.json().then(data => {
      throw new Error(data.message || 'Failed to fetch')
    })
  }
  return res.json()
})

export default function AISummaryCard({ stageId }: Props) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<AISummaryData>(
    stageId ? `/api/stages/${stageId}/ai-summary` : null,
    fetcher,
    {
      revalidateOnFocus: false, // Disable auto-generation
      revalidateOnMount: false, // Disable auto-generation on mount
      revalidateOnReconnect: false, // Disable auto-generation on reconnect
      shouldRetryOnError: false,
      dedupingInterval: 60000 // Cache for 1 minute
    }
  )

  const handleRefresh = async () => {
    setIsManualRefreshing(true)
    try {
      await mutate()
      toast.success('AI Summary updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh summary')
    } finally {
      setIsManualRefreshing(false)
    }
  }

  const handleEdit = () => {
    setEditedText(data?.summary || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/stages/${stageId}/custom-summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: editedText })
      })
      
      if (!response.ok) throw new Error('Failed to save')
      
      // Update local data
      await mutate()
      setIsEditing(false)
      toast.success('Summary saved')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save summary')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedText('')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">AI Summary</h3>
          </div>
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
        </div>
        
        {/* Skeleton loading */}
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-indigo-200/50 rounded w-full"></div>
          <div className="h-3 bg-indigo-200/50 rounded w-5/6"></div>
          <div className="h-3 bg-indigo-200/50 rounded w-4/6"></div>
        </div>
      </div>
    )
  }

  // Error state or no data - show generate button
  if (error || !data) {
    const isRateLimited = error?.message?.includes('wait') || error?.message?.includes('minute')
    
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">AI Summary</h3>
        </div>
        
        {error && !isRateLimited ? (
          <div className="text-xs text-red-600 mb-3">
            {error.message || 'Failed to generate'}
          </div>
        ) : isRateLimited ? (
          <div className="text-xs text-amber-600 mb-3 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Please wait before trying again
          </div>
        ) : (
          <p className="text-xs text-gray-600 mb-3">
            Generate an AI summary of your design concept items.
          </p>
        )}
        
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-100"
          disabled={isManualRefreshing || isRateLimited}
        >
          {isManualRefreshing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Summary
            </>
          )}
        </Button>
      </div>
    )
  }

  // Parse summary text and format it
  const summaryLines = data.summary.split('\n').filter(line => line.trim())
  const previewLines = summaryLines.slice(0, 3)
  const hasMore = summaryLines.length > 3

  const generatedTime = data.meta.generatedAt 
    ? formatDistanceToNow(new Date(data.meta.generatedAt), { addSuffix: true })
    : 'just now'

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-indigo-100 bg-white/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Summary</h3>
              <p className="text-xs text-gray-500">
                {data.counts.total} item{data.counts.total !== 1 ? 's' : ''}
                {data.meta.imagesAnalyzed > 0 && `, ${data.meta.imagesAnalyzed} image${data.meta.imagesAnalyzed !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {!isEditing && (
              <>
                <Button
                  onClick={handleRefresh}
                  variant="ghost"
                  size="sm"
                  className="text-indigo-700 hover:bg-indigo-100 h-7 px-2"
                  disabled={isManualRefreshing}
                  aria-label="Refresh AI summary"
                >
                  {isManualRefreshing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              </>
            )}
            
            {hasMore && !isEditing && (
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900 h-7 px-2"
                aria-label={isExpanded ? 'Show less' : 'Show more'}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="prose prose-sm max-w-none text-xs prose-p:text-gray-700 prose-p:my-2 prose-p:leading-relaxed">
          {isExpanded || !hasMore ? (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 text-xs">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
              }}
            >
              {data.summary}
            </ReactMarkdown>
          ) : (
            <>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 text-xs">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                }}
              >
                {previewLines.join('\n')}
              </ReactMarkdown>
              <button
                onClick={() => setIsExpanded(true)}
                className="text-indigo-600 hover:text-indigo-700 font-medium text-xs mt-1 inline-flex items-center"
              >
                Read more
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white/60 border-t border-indigo-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
              {data.counts.completed}
            </span>
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1"></span>
              {data.counts.pending}
            </span>
          </div>
          <span className="text-xs">{generatedTime}</span>
        </div>
      </div>
    </div>
  )
}
