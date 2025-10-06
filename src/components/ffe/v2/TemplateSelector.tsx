'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, 
  Package, 
  Star, 
  Plus, 
  Loader2,
  ChevronRight,
  Layout,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFFETemplates } from '@/hooks/ffe/useFFEApi'

interface TemplateSelectorProps {
  orgId: string
  onTemplateSelected: (templateId?: string, templateName?: string) => void
  isCreating: boolean
}

export default function TemplateSelector({
  orgId,
  onTemplateSelected,
  isCreating
}: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  
  
  // Get ALL active templates (not filtered by room type)
  const { templates, isLoading, error } = useFFETemplates(orgId, {
    // roomType: roomType as any, // Removed - allow selecting any template for any room
    search: searchTerm || undefined
  })
  
  
  // Filter and sort templates - only show active templates
  const filteredTemplates = templates
    .filter(template => template.isActive === true)
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  
  const handleSelectTemplate = (template?: any) => {
    if (template) {
      setSelectedTemplateId(template.id)
      onTemplateSelected(template.id, template.name)
    } else {
      // Blank template
      setSelectedTemplateId('blank')
      onTemplateSelected(undefined, 'Custom Template')
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-600">Loading templates...</span>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load templates</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Create Blank Template Option */}
      <Card 
        className={cn(
          "cursor-pointer border-2 transition-all hover:shadow-md",
          selectedTemplateId === 'blank' 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-200 hover:border-gray-300"
        )}
        onClick={() => handleSelectTemplate()}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Start from Blank</h3>
                <p className="text-sm text-gray-600">Create a custom template from scratch</p>
              </div>
            </div>
            {selectedTemplateId === 'blank' && (
              <CheckCircle className="h-5 w-5 text-blue-600" />
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Templates List */}
      {filteredTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">All Available Templates</h3>
          <p className="text-xs text-gray-500 mb-2">You can use any template with any room type</p>
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <Card 
                  key={template.id}
                  className={cn(
                    "cursor-pointer border-2 transition-all hover:shadow-md",
                    selectedTemplateId === template.id 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Layout className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{template.name}</h3>
                            {template.isDefault && (
                              <Badge variant="secondary" className="h-5">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {template.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{template.sections?.length || 0} sections</span>
                            <span>•</span>
                            <span>Version {template.version}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {selectedTemplateId === template.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* No Templates Message */}
      {filteredTemplates.length === 0 && !searchTerm && (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No Templates Available</h3>
          <p className="text-sm text-gray-600 mb-4">
            There are no active templates available yet.
          </p>
          <p className="text-xs text-gray-500">
            You can start with a blank template or ask your administrator to create templates for any room type.
          </p>
        </div>
      )}
      
      {/* No Search Results */}
      {filteredTemplates.length === 0 && searchTerm && (
        <div className="text-center py-8">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No Results Found</h3>
          <p className="text-sm text-gray-600">
            No templates match "{searchTerm}". Try a different search term.
          </p>
        </div>
      )}
      
      {/* Action Buttons */}
      {selectedTemplateId && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setSelectedTemplateId(null)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              const selected = selectedTemplateId === 'blank' 
                ? undefined 
                : filteredTemplates.find(t => t.id === selectedTemplateId)
              handleSelectTemplate(selected)
            }}
            disabled={isCreating}
          >
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating ? 'Creating...' : 'Use Template'}
          </Button>
        </div>
      )}
    </div>
  )
}