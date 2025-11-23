'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  projectId: string
  projectName: string
}

export function AISummarySection({ projectId, projectName }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/reports/${projectId}/ai-summary`)
      const result = await response.json()
      
      if (!response.ok) {
        setError(result.error || 'Failed to generate AI summary')
      } else {
        setData(result)
        setIsExpanded(true)
      }
    } catch (err) {
      setError('Failed to generate AI summary. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Initial state - show generate button
  if (!data && !error && !isLoading) {
    return (
      <div className="bg-white rounded-lg p-4 border-2 border-indigo-200 hover:border-indigo-300 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-sm text-gray-900">AI Summary</h3>
          </div>
          <Button
            onClick={handleGenerate}
            size="sm"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-4 border-2 border-indigo-200">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
          <h3 className="font-semibold text-sm text-gray-900">AI Summary</h3>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    const isRateLimit = error.includes('wait')

    return (
      <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <h3 className="font-semibold text-sm text-gray-900">AI Summary</h3>
          </div>
          {!isRateLimit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              className="text-red-600 hover:bg-red-100"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </div>
        <p className="text-xs text-red-700">{error}</p>
      </div>
    )
  }

  // Success state
  const summary = data?.summary || ''
  
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm text-gray-900">AI Summary</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={isLoading}
          className="text-indigo-600 hover:bg-indigo-100 h-7 px-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">
        {summary}
      </p>
    </div>
  )
}
