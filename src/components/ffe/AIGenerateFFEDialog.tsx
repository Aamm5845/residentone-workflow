'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  ChevronRight,
  Package,
  Import,
  Loader2,
  Wand2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface DetectedFFEItem {
  name: string
  description?: string
  category: string
  confidence: 'high' | 'medium' | 'low'
}

interface DetectedFFECategory {
  name: string
  items: DetectedFFEItem[]
}

interface AIFFEDetectionResult {
  categories: DetectedFFECategory[]
  roomDescription: string
  designStyle: string
  totalItemsDetected: number
}

interface AIGenerateFFEDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
  roomName: string
  onImportItems: (categories: DetectedFFECategory[], selectedItems: Set<string>) => Promise<void>
}

export default function AIGenerateFFEDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  onImportItems
}: AIGenerateFFEDialogProps) {
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<AIFFEDetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [meta, setMeta] = useState<any>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedItems(new Set())
    setExpandedCategories(new Set())

    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to analyze images')
      }

      if (data.success && data.data) {
        setResult(data.data)
        setMeta(data.meta)
        
        // Auto-select all high and medium confidence items
        const autoSelected = new Set<string>()
        data.data.categories.forEach((category: DetectedFFECategory) => {
          category.items.forEach((item) => {
            if (item.confidence === 'high' || item.confidence === 'medium') {
              autoSelected.add(`${category.name}::${item.name}`)
            }
          })
        })
        setSelectedItems(autoSelected)
        
        // Auto-expand all categories
        setExpandedCategories(new Set(data.data.categories.map((c: DetectedFFECategory) => c.name)))
        
        if (data.data.totalItemsDetected === 0) {
          setError('No items detected. Please ensure your 3D rendering images are uploaded and visible.')
        }
      }
    } catch (err: any) {
      console.error('AI analysis error:', err)
      setError(err.message || 'Failed to analyze images')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleItem = (categoryName: string, itemName: string) => {
    const key = `${categoryName}::${itemName}`
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const handleToggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  const handleSelectAllInCategory = (category: DetectedFFECategory, select: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      category.items.forEach(item => {
        const key = `${category.name}::${item.name}`
        if (select) {
          newSet.add(key)
        } else {
          newSet.delete(key)
        }
      })
      return newSet
    })
  }

  const handleImport = async () => {
    if (!result || selectedItems.size === 0) {
      toast.error('Please select items to import')
      return
    }

    setImporting(true)
    try {
      await onImportItems(result.categories, selectedItems)
      toast.success(`Successfully imported ${selectedItems.size} FFE items`)
      onOpenChange(false)
    } catch (err: any) {
      console.error('Import error:', err)
      toast.error(err.message || 'Failed to import items')
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = selectedItems.size
  const totalCount = result?.totalItemsDetected || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#e94d97] rounded-xl">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                AI FFE Detection
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                Automatically detect items from your 3D renderings
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-6">
          {/* Initial State - No Analysis Yet */}
          {!loading && !result && !error && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-[#e94d97]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Wand2 className="h-10 w-10 text-[#e94d97]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Analyze {roomName} Renderings
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                AI will scan your latest 3D rendering images and identify all furniture, 
                fixtures, finishes, and equipment visible in the space.
              </p>
              
              <Button
                onClick={handleAnalyze}
                className="bg-[#e94d97] hover:bg-[#db2777] text-white px-8"
                size="lg"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start AI Analysis
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-[#e94d97]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-10 w-10 text-[#e94d97] animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Analyzing Renderings...
              </h3>
              <p className="text-gray-600 mb-4">
                AI is scanning your images for FFE items. This may take 15-30 seconds.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-[#e94d97]">
                <div className="w-2 h-2 bg-[#e94d97] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#e94d97] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#e94d97] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {result ? 'No Items Found' : 'Analysis Failed'}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {error}
              </p>
              <Button
                onClick={handleAnalyze}
                variant="outline"
                className="mr-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Results */}
          {result && result.totalItemsDetected > 0 && !loading && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-r from-[#e94d97]/10 to-[#e94d97]/20 border border-[#e94d97]/30 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-[#e94d97]/20 text-[#db2777] border-[#e94d97]/30">
                        {result.designStyle}
                      </Badge>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        {totalCount} items detected
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700">{result.roomDescription}</p>
                  </div>
                  {meta && (
                    <div className="text-xs text-gray-500 text-right">
                      <p>{meta.imagesAnalyzed} image(s) analyzed</p>
                      <p>{(meta.processingTimeMs / 1000).toFixed(1)}s</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between px-1">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{selectedCount}</span> of {totalCount} items selected
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const all = new Set<string>()
                      result.categories.forEach(cat => {
                        cat.items.forEach(item => {
                          all.add(`${cat.name}::${item.name}`)
                        })
                      })
                      setSelectedItems(all)
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItems(new Set())}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                {result.categories.map((category) => {
                  const isExpanded = expandedCategories.has(category.name)
                  const selectedInCategory = category.items.filter(item => 
                    selectedItems.has(`${category.name}::${item.name}`)
                  ).length
                  const allSelected = selectedInCategory === category.items.length
                  const noneSelected = selectedInCategory === 0

                  return (
                    <div 
                      key={category.name}
                      className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                    >
                      {/* Category Header */}
                      <div 
                        className="flex items-center gap-3 p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleToggleCategory(category.name)}
                      >
                        <div className={cn(
                          "transition-transform duration-200",
                          isExpanded ? "rotate-90" : "rotate-0"
                        )}>
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        </div>
                        
                        <div className="p-2 bg-white rounded-lg border border-gray-200">
                          <Package className="h-4 w-4 text-gray-600" />
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{category.name}</h4>
                          <p className="text-xs text-gray-500">
                            {selectedInCategory} of {category.items.length} selected
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => handleSelectAllInCategory(category, !!checked)}
                            className={cn(
                              !allSelected && !noneSelected && "data-[state=checked]:bg-gray-400"
                            )}
                          />
                        </div>
                      </div>

                      {/* Category Items */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-100">
                          {category.items.map((item, index) => {
                            const isSelected = selectedItems.has(`${category.name}::${item.name}`)
                            
                            return (
                              <div 
                                key={`${item.name}-${index}`}
                                className={cn(
                                  "flex items-center gap-3 p-4 pl-14 transition-colors cursor-pointer",
                                  isSelected ? "bg-[#e94d97]/10" : "hover:bg-gray-50"
                                )}
                                onClick={() => handleToggleItem(category.name, item.name)}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleItem(category.name, item.name)}
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-gray-900 truncate block">
                                    {item.name}
                                  </span>
                                  {item.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {result && result.totalItemsDetected > 0 && (
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleAnalyze}
              disabled={loading || importing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Re-analyze
            </Button>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedItems.size === 0 || importing}
                className="bg-[#e94d97] hover:bg-[#db2777] text-white"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Import className="h-4 w-4 mr-2" />
                    Import {selectedCount} Items
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
