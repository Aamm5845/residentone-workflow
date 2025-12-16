'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  ChevronRight,
  ChevronDown,
  Package,
  Import,
  Loader2,
  Wand2,
  Edit3,
  Check,
  X,
  Briefcase,
  ArrowRight,
  Trash2,
  Link,
  Settings2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface DetectedFFEItem {
  name: string
  description?: string
  category: string
  confidence: 'high' | 'medium' | 'low'
  customizable?: boolean // Items that can have linked sub-components
}

// Configuration for linked sub-items when an item is marked as "custom"
const CUSTOM_ITEM_LINKED_COMPONENTS: Record<string, string[]> = {
  // Bedroom items
  'bed': ['Fabric (Headboard)', 'Legs/Frame'],
  'headboard': ['Fabric', 'Frame'],
  
  // Seating
  'chair': ['Wood Color', 'Fabric'],
  'armchair': ['Wood Color', 'Fabric'],
  'dining chair': ['Wood Color', 'Fabric/Upholstery'],
  'accent chair': ['Wood Color', 'Fabric'],
  'lounge chair': ['Frame Finish', 'Fabric'],
  'sofa': ['Fabric', 'Legs'],
  'sectional': ['Fabric', 'Legs'],
  'loveseat': ['Fabric', 'Legs'],
  'ottoman': ['Fabric', 'Legs'],
  'bench': ['Fabric/Seat Material', 'Frame/Legs'],
  'stool': ['Seat Material', 'Frame Finish'],
  'bar stool': ['Seat Material', 'Frame Finish'],
  
  // Bathroom items
  'vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  'bathroom vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  'double vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  'single vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  
  // Kitchen items
  'cabinet': ['Finish/Paint', 'Hardware/Handles'],
  'kitchen cabinet': ['Finish/Paint', 'Hardware/Handles', 'Countertop'],
  'kitchen island': ['Counter/Top', 'Cabinet Finish', 'Hardware'],
  
  // Storage
  'wardrobe': ['Interior Configuration', 'Door Finish', 'Hardware'],
  'closet': ['Interior Configuration', 'Door Finish', 'Hardware'],
  'dresser': ['Finish', 'Hardware/Handles'],
  'nightstand': ['Finish', 'Hardware'],
  'bedside table': ['Finish', 'Hardware'],
  
  // Tables
  'dining table': ['Top Material', 'Base/Legs'],
  'coffee table': ['Top Material', 'Base/Legs'],
  'side table': ['Top Material', 'Base/Legs'],
  'console table': ['Top Material', 'Base/Legs'],
  'desk': ['Top Material', 'Frame/Legs'],
}

/**
 * Get linked components for an item if it's customizable
 */
function getLinkedComponentsForItem(itemName: string): string[] | null {
  const normalizedName = itemName.toLowerCase().trim()
  
  // Direct match first
  if (CUSTOM_ITEM_LINKED_COMPONENTS[normalizedName]) {
    return CUSTOM_ITEM_LINKED_COMPONENTS[normalizedName]
  }
  
  // Check if item name contains any of the keywords
  for (const [keyword, components] of Object.entries(CUSTOM_ITEM_LINKED_COMPONENTS)) {
    if (normalizedName.includes(keyword)) {
      return components
    }
  }
  
  return null
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

interface EditableItem extends DetectedFFEItem {
  isEditing: boolean
  editedName: string
  editedDescription: string
  isCustom?: boolean // User's choice: true = custom with linked items, false/undefined = standard
  linkedComponents?: string[] // Components that will be added if custom
}

interface EditableCategory {
  name: string
  items: EditableItem[]
}

// Extended category type for import that includes custom item info
export interface ImportableCategory {
  name: string
  items: Array<{
    name: string
    description?: string
    isCustom?: boolean
    linkedItems?: string[] // Names of linked items to create
  }>
}

interface AIGenerateFFEDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
  roomName: string
  onImportItems: (categories: ImportableCategory[], selectedItems: Set<string>) => Promise<void>
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
  const [editableCategories, setEditableCategories] = useState<EditableCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [customItems, setCustomItems] = useState<Set<string>>(new Set()) // Track items marked as custom
  const [meta, setMeta] = useState<any>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setEditableCategories([])
    setSelectedItems(new Set())
    setExpandedCategories(new Set())
    setCustomItems(new Set())

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
        
        const editable: EditableCategory[] = data.data.categories.map((category: DetectedFFECategory) => ({
          name: category.name,
          items: category.items.map(item => {
            // Check if this item can be customizable
            const linkedComponents = getLinkedComponentsForItem(item.name)
            const isCustomizable = item.customizable === true || linkedComponents !== null
            
            return {
              ...item,
              isEditing: false,
              editedName: item.name,
              editedDescription: item.description || '',
              customizable: isCustomizable,
              isCustom: false, // Default to standard
              linkedComponents: linkedComponents || undefined
            }
          })
        }))
        setEditableCategories(editable)
        
        const autoSelected = new Set<string>()
        data.data.categories.forEach((category: DetectedFFECategory) => {
          category.items.forEach((item) => {
            if (item.confidence === 'high' || item.confidence === 'medium') {
              autoSelected.add(`${category.name}::${item.name}`)
            }
          })
        })
        setSelectedItems(autoSelected)
        setExpandedCategories(new Set(data.data.categories.map((c: DetectedFFECategory) => c.name)))
        
        if (data.data.totalItemsDetected === 0) {
          setError('No items detected. Please ensure your 3D rendering images are uploaded.')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze images')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleItem = (categoryName: string, itemName: string) => {
    const key = `${categoryName}::${itemName}`
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) newSet.delete(key)
      else newSet.add(key)
      return newSet
    })
  }

  const handleToggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) newSet.delete(categoryName)
      else newSet.add(categoryName)
      return newSet
    })
  }

  const handleSelectAllInCategory = (category: EditableCategory, select: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      category.items.forEach(item => {
        const key = `${category.name}::${item.name}`
        if (select) newSet.add(key)
        else newSet.delete(key)
      })
      return newSet
    })
  }

  const handleStartEdit = (categoryIndex: number, itemIndex: number) => {
    setEditableCategories(prev => prev.map((cat, cIdx) => ({
      ...cat,
      items: cat.items.map((item, iIdx) => ({
        ...item,
        isEditing: cIdx === categoryIndex && iIdx === itemIndex
      }))
    })))
  }

  const handleSaveEdit = (categoryIndex: number, itemIndex: number) => {
    setEditableCategories(prev => {
      const updated = [...prev]
      const item = updated[categoryIndex].items[itemIndex]
      const oldKey = `${updated[categoryIndex].name}::${item.name}`
      const newKey = `${updated[categoryIndex].name}::${item.editedName}`
      
      if (selectedItems.has(oldKey) && item.name !== item.editedName) {
        setSelectedItems(prevSelected => {
          const newSet = new Set(prevSelected)
          newSet.delete(oldKey)
          newSet.add(newKey)
          return newSet
        })
      }
      
      item.name = item.editedName
      item.description = item.editedDescription
      item.isEditing = false
      return updated
    })
    toast.success('Item updated')
  }

  const handleCancelEdit = (categoryIndex: number, itemIndex: number) => {
    setEditableCategories(prev => prev.map((cat, cIdx) => ({
      ...cat,
      items: cat.items.map((item, iIdx) => {
        if (cIdx === categoryIndex && iIdx === itemIndex) {
          return { ...item, isEditing: false, editedName: item.name, editedDescription: item.description || '' }
        }
        return item
      })
    })))
  }

  const handleDeleteItem = (categoryIndex: number, itemIndex: number) => {
    const category = editableCategories[categoryIndex]
    const item = category.items[itemIndex]
    const key = `${category.name}::${item.name}`
    
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
    
    setCustomItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
    
    setEditableCategories(prev => prev.map((cat, cIdx) => {
      if (cIdx === categoryIndex) {
        return { ...cat, items: cat.items.filter((_, iIdx) => iIdx !== itemIndex) }
      }
      return cat
    }).filter(cat => cat.items.length > 0))
    
    toast.success('Item removed')
  }

  // Toggle whether an item is custom (with linked items) or standard
  const handleToggleCustom = (categoryName: string, itemName: string) => {
    const key = `${categoryName}::${itemName}`
    setCustomItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
    
    // Update the editable categories to reflect the change
    setEditableCategories(prev => prev.map(cat => {
      if (cat.name === categoryName) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.name === itemName) {
              return { ...item, isCustom: !item.isCustom }
            }
            return item
          })
        }
      }
      return cat
    }))
  }

  const handleImport = async () => {
    if (!result || selectedItems.size === 0) {
      toast.error('Please select items to import')
      return
    }

    setImporting(true)
    try {
      // Build categories with custom item info and linked items
      const categoriesForImport: ImportableCategory[] = editableCategories.map(cat => ({
        name: cat.name,
        items: cat.items.map(item => {
          const key = `${cat.name}::${item.name}`
          const isCustom = customItems.has(key)
          
          return {
            name: item.name,
            description: item.description,
            isCustom,
            // If custom, include the linked items that should be created
            linkedItems: isCustom && item.linkedComponents ? item.linkedComponents : undefined
          }
        })
      }))
      
      await onImportItems(categoriesForImport, selectedItems)
      
      // Count linked items that will be added
      let linkedCount = 0
      for (const key of selectedItems) {
        if (customItems.has(key)) {
          const [categoryName, itemName] = key.split('::')
          const cat = editableCategories.find(c => c.name === categoryName)
          const item = cat?.items.find(i => i.name === itemName)
          if (item?.linkedComponents) {
            linkedCount += item.linkedComponents.length
          }
        }
      }
      
      const linkedMsg = linkedCount > 0 ? ` (+ ${linkedCount} linked components)` : ''
      toast.success(`${selectedItems.size} items imported to workspace${linkedMsg}!`)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to import items')
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = selectedItems.size
  const totalCount = editableCategories.reduce((acc, cat) => acc + cat.items.length, 0)
  
  // Calculate how many linked items will be added for custom items
  const linkedItemsCount = React.useMemo(() => {
    let count = 0
    for (const key of selectedItems) {
      if (customItems.has(key)) {
        const [categoryName, itemName] = key.split('::')
        const cat = editableCategories.find(c => c.name === categoryName)
        const item = cat?.items.find(i => i.name === itemName)
        if (item?.linkedComponents) {
          count += item.linkedComponents.length
        }
      }
    }
    return count
  }, [selectedItems, customItems, editableCategories])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e94d97] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">AI FFE Detection</DialogTitle>
              <p className="text-sm text-gray-500">Detect and customize items from 3D renderings</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-6">
          {/* Initial State */}
          {!loading && !result && !error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Wand2 className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyze {roomName}</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                AI will scan your 3D rendering images and identify furniture, fixtures, finishes, and equipment. You can edit each item before importing.
              </p>
              <Button onClick={handleAnalyze} className="bg-[#e94d97] hover:bg-[#d63d87] text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                Start AI Analysis
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Renderings...</h3>
              <p className="text-gray-500">This may take 15-30 seconds.</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-gray-500 mb-6">{error}</p>
              <Button variant="outline" onClick={handleAnalyze}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Results */}
          {result && totalCount > 0 && !loading && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{result.designStyle}</Badge>
                      <Badge className="bg-[#14b8a6]/10 text-[#14b8a6]">{totalCount} items detected</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{result.roomDescription}</p>
                  </div>
                  {meta && (
                    <div className="text-xs text-gray-400 text-right">
                      <p>{meta.imagesAnalyzed} image(s)</p>
                      <p>{(meta.processingTimeMs / 1000).toFixed(1)}s</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Info */}
              <div className="bg-[#6366ea]/10 rounded-lg p-3 text-sm text-[#6366ea] border border-[#6366ea]/20">
                <Edit3 className="h-4 w-4 inline mr-2" />
                Click the edit icon on any item to customize its name or description before importing.
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{selectedCount}</span> of {totalCount} selected
                  {linkedItemsCount > 0 && (
                    <span className="ml-2 text-[#e94d97]">
                      (+{linkedItemsCount} linked components)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const all = new Set<string>()
                    editableCategories.forEach(cat => cat.items.forEach(item => all.add(`${cat.name}::${item.name}`)))
                    setSelectedItems(all)
                  }}>Select All</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>Deselect All</Button>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                {editableCategories.map((category, categoryIndex) => {
                  const isExpanded = expandedCategories.has(category.name)
                  const selectedInCategory = category.items.filter(item => selectedItems.has(`${category.name}::${item.name}`)).length

                  return (
                    <div key={category.name} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                      <div 
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleToggleCategory(category.name)}
                      >
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                        <div className="w-8 h-8 rounded-lg bg-[#e94d97] flex items-center justify-center">
                          <Package className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{category.name}</h4>
                          <p className="text-xs text-gray-500">{selectedInCategory} of {category.items.length} selected</p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedInCategory === category.items.length}
                            onCheckedChange={(checked) => handleSelectAllInCategory(category, !!checked)}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 divide-y divide-gray-100">
                          {category.items.map((item, itemIndex) => {
                            const isSelected = selectedItems.has(`${category.name}::${item.name}`)
                            
                            return (
                              <div key={`${item.name}-${itemIndex}`} className={cn("p-4 pl-14", isSelected && "bg-[#14b8a6]/5")}>
                                {item.isEditing ? (
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs font-medium text-gray-500">Item Name</label>
                                      <Input
                                        value={item.editedName}
                                        onChange={(e) => {
                                          setEditableCategories(prev => prev.map((cat, cIdx) => ({
                                            ...cat,
                                            items: cat.items.map((it, iIdx) => {
                                              if (cIdx === categoryIndex && iIdx === itemIndex) {
                                                return { ...it, editedName: e.target.value }
                                              }
                                              return it
                                            })
                                          })))
                                        }}
                                        className="mt-1"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-gray-500">Description</label>
                                      <Textarea
                                        value={item.editedDescription}
                                        onChange={(e) => {
                                          setEditableCategories(prev => prev.map((cat, cIdx) => ({
                                            ...cat,
                                            items: cat.items.map((it, iIdx) => {
                                              if (cIdx === categoryIndex && iIdx === itemIndex) {
                                                return { ...it, editedDescription: e.target.value }
                                              }
                                              return it
                                            })
                                          })))
                                        }}
                                        rows={2}
                                        className="mt-1"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleSaveEdit(categoryIndex, itemIndex)}>
                                        <Check className="h-4 w-4 mr-1" />
                                        Save
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => handleCancelEdit(categoryIndex, itemIndex)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-3">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleItem(category.name, item.name)}
                                        className="mt-1"
                                      />
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleItem(category.name, item.name)}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-gray-900">{item.name}</span>
                                          {item.customizable && (
                                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                                              <Settings2 className="h-3 w-3 mr-1" />
                                              Customizable
                                            </Badge>
                                          )}
                                        </div>
                                        {item.description && <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(categoryIndex, itemIndex)} className="text-gray-400 hover:text-gray-600">
                                          <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(categoryIndex, itemIndex)} className="text-gray-400 hover:text-red-500">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    {/* Custom vs Standard selection for customizable items */}
                                    {item.customizable && isSelected && item.linkedComponents && (
                                      <div className="ml-8 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-sm font-medium text-gray-700">Is this item custom-made?</span>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              variant={!customItems.has(`${category.name}::${item.name}`) ? "default" : "outline"}
                                              className={cn(
                                                "text-xs h-7 px-3",
                                                !customItems.has(`${category.name}::${item.name}`) && "bg-gray-700 hover:bg-gray-800"
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (customItems.has(`${category.name}::${item.name}`)) {
                                                  handleToggleCustom(category.name, item.name)
                                                }
                                              }}
                                            >
                                              Standard
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant={customItems.has(`${category.name}::${item.name}`) ? "default" : "outline"}
                                              className={cn(
                                                "text-xs h-7 px-3",
                                                customItems.has(`${category.name}::${item.name}`) && "bg-[#e94d97] hover:bg-[#d63d87]"
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (!customItems.has(`${category.name}::${item.name}`)) {
                                                  handleToggleCustom(category.name, item.name)
                                                }
                                              }}
                                            >
                                              Custom
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        {customItems.has(`${category.name}::${item.name}`) && (
                                          <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                              <Link className="h-3 w-3" />
                                              <span>The following linked items will be added:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {item.linkedComponents.map((component, idx) => (
                                                <Badge 
                                                  key={idx}
                                                  variant="outline" 
                                                  className="text-xs bg-[#e94d97]/10 text-[#e94d97] border-[#e94d97]/30"
                                                >
                                                  + {component}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {!customItems.has(`${category.name}::${item.name}`) && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Standard: Only the main item will be added
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
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
        {result && totalCount > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 flex-shrink-0">
            <Button variant="outline" onClick={handleAnalyze} disabled={loading || importing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Re-analyze
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
              <Button onClick={handleImport} disabled={selectedItems.size === 0 || importing} className="bg-[#e94d97] hover:bg-[#d63d87] text-white">
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Briefcase className="h-4 w-4 mr-2" />
                    Import {selectedCount}{linkedItemsCount > 0 ? ` (+${linkedItemsCount})` : ''} to Workspace
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
