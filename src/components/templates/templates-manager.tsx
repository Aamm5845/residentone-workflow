'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  LayoutTemplate,
  GripVertical,
  Trash2,
  Copy,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Settings,
  Edit3,
  Save,
  X,
  Check,
  Package,
  Layers,
  File
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Template {
  id: string
  name: string
  description: string | null
  status: string
  isDefault: boolean
  sections: TemplateSection[]
  createdAt: string
  updatedAt: string
}

interface TemplateSection {
  id: string
  name: string
  order: number
  items: TemplateItem[]
}

interface TemplateItem {
  id: string
  name: string
  description: string | null
  isRequired: boolean
  defaultState: string
  order: number
}

interface TemplatesManagerProps {
  userId: string
  orgId: string
  userRole: string
}

// Default sections available for FFE templates
const DEFAULT_SECTIONS = [
  { name: 'Furniture', icon: '🪑', description: 'Tables, chairs, sofas, beds, storage' },
  { name: 'Lighting', icon: '💡', description: 'Overhead, task, accent, decorative lighting' },
  { name: 'Plumbing', icon: '🚿', description: 'Toilets, sinks, bathtubs, showers, faucets' },
  { name: 'Flooring', icon: '🏠', description: 'Primary flooring, rugs, transitions' },
  { name: 'Wall Treatments', icon: '🎨', description: 'Paint, wallpaper, accent walls' },
  { name: 'Ceiling', icon: '⬜', description: 'Ceiling finish, molding, features' },
  { name: 'Window Treatments', icon: '🪟', description: 'Curtains, blinds, shades' },
  { name: 'Accessories', icon: '🖼️', description: 'Art, plants, decorative objects' },
  { name: 'Hardware', icon: '🔧', description: 'Door handles, cabinet pulls, knobs' },
  { name: 'Textiles', icon: '🛏️', description: 'Bedding, throws, pillows, upholstery' },
  { name: 'Appliances', icon: '📺', description: 'Kitchen and laundry appliances' },
]

export default function TemplatesManager({ userId, orgId, userRole }: TemplatesManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Selected template for editing
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [editMode, setEditMode] = useState(false)
  
  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSections, setEditSections] = useState<TemplateSection[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  // Dialogs
  const [createDialog, setCreateDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null)
  const [addSectionDialog, setAddSectionDialog] = useState(false)
  const [addItemDialog, setAddItemDialog] = useState<{ sectionId: string } | null>(null)
  
  // New template form
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  
  // New item form
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemRequired, setNewItemRequired] = useState(false)

  // Load templates
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/ffe/v2/templates')
      const data = await res.json()
      if (data.success && data.data) {
        setTemplates(data.data)
        // Select first template by default if none selected
        if (data.data.length > 0 && !selectedTemplate) {
          setSelectedTemplate(data.data[0])
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = (template: Template) => {
    if (editMode) {
      // Save changes first or discard
      if (window.confirm('Discard unsaved changes?')) {
        setEditMode(false)
      } else {
        return
      }
    }
    setSelectedTemplate(template)
    setEditName(template.name)
    setEditDescription(template.description || '')
    setEditSections(template.sections || [])
    setExpandedSections(new Set())
  }

  const handleStartEdit = () => {
    if (selectedTemplate) {
      setEditName(selectedTemplate.name)
      setEditDescription(selectedTemplate.description || '')
      setEditSections(selectedTemplate.sections || [])
      setEditMode(true)
    }
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    if (selectedTemplate) {
      setEditName(selectedTemplate.name)
      setEditDescription(selectedTemplate.description || '')
      setEditSections(selectedTemplate.sections || [])
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedTemplate) return

    try {
      const res = await fetch(`/api/ffe/v2/templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          sections: editSections.map((s, i) => ({
            name: s.name,
            order: i,
            items: s.items.map((item, j) => ({
              name: item.name,
              description: item.description,
              isRequired: item.isRequired,
              defaultState: item.defaultState || 'PENDING',
              order: j
            }))
          }))
        })
      })

      if (res.ok) {
        await loadTemplates()
        setEditMode(false)
      }
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return

    try {
      const res = await fetch('/api/ffe/v2/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName,
          description: newTemplateDescription,
          sections: []
        })
      })

      if (res.ok) {
        const data = await res.json()
        await loadTemplates()
        setCreateDialog(false)
        setNewTemplateName('')
        setNewTemplateDescription('')
        // Select the new template
        if (data.data) {
          setSelectedTemplate(data.data)
          setEditMode(true)
        }
      }
    } catch (error) {
      console.error('Failed to create template:', error)
    }
  }

  const handleCopyTemplate = async (template: Template) => {
    try {
      const res = await fetch(`/api/ffe/v2/templates/${template.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`
        })
      })

      if (res.ok) {
        await loadTemplates()
      }
    } catch (error) {
      console.error('Failed to copy template:', error)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteConfirm) return

    try {
      const res = await fetch(`/api/ffe/v2/templates/${deleteConfirm.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await loadTemplates()
        if (selectedTemplate?.id === deleteConfirm.id) {
          setSelectedTemplate(null)
          setEditMode(false)
        }
        setDeleteConfirm(null)
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const handleAddSection = (sectionName: string) => {
    const newSection: TemplateSection = {
      id: `new-${Date.now()}`,
      name: sectionName,
      order: editSections.length,
      items: []
    }
    setEditSections([...editSections, newSection])
    setExpandedSections(prev => new Set([...prev, newSection.id]))
    setAddSectionDialog(false)
  }

  const handleRemoveSection = (sectionId: string) => {
    setEditSections(editSections.filter(s => s.id !== sectionId))
  }

  const handleAddItem = () => {
    if (!addItemDialog || !newItemName.trim()) return

    const sectionIndex = editSections.findIndex(s => s.id === addItemDialog.sectionId)
    if (sectionIndex === -1) return

    const newItem: TemplateItem = {
      id: `new-item-${Date.now()}`,
      name: newItemName,
      description: newItemDescription || null,
      isRequired: newItemRequired,
      defaultState: 'PENDING',
      order: editSections[sectionIndex].items.length
    }

    const updatedSections = [...editSections]
    updatedSections[sectionIndex] = {
      ...updatedSections[sectionIndex],
      items: [...updatedSections[sectionIndex].items, newItem]
    }

    setEditSections(updatedSections)
    setAddItemDialog(null)
    setNewItemName('')
    setNewItemDescription('')
    setNewItemRequired(false)
  }

  const handleRemoveItem = (sectionId: string, itemId: string) => {
    const sectionIndex = editSections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) return

    const updatedSections = [...editSections]
    updatedSections[sectionIndex] = {
      ...updatedSections[sectionIndex],
      items: updatedSections[sectionIndex].items.filter(i => i.id !== itemId)
    }
    setEditSections(updatedSections)
  }

  const toggleSectionExpand = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getSectionIcon = (name: string) => {
    const section = DEFAULT_SECTIONS.find(s => s.name === name)
    return section?.icon || '📦'
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Template List */}
      <aside className="w-80 border-r bg-gray-50/50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-purple-600" />
              FFE Templates
            </h2>
            <Button size="sm" onClick={() => setCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {searchQuery ? 'No templates found' : 'No templates yet'}
              </p>
              {!searchQuery && (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setCreateDialog(true)}
                  className="mt-2"
                >
                  Create your first template
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'bg-purple-100 border-purple-200 border'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {template.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {template.sections?.length || 0} sections • {
                          template.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0
                        } items
                      </p>
                    </div>
                    {template.isDefault && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        Default
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - Template Editor */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedTemplate ? (
          <>
            {/* Header */}
            <header className="p-4 border-b flex items-center justify-between">
              <div className="flex-1">
                {editMode ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xl font-semibold max-w-md"
                    placeholder="Template name"
                  />
                ) : (
                  <h1 className="text-xl font-semibold text-gray-900">
                    {selectedTemplate.name}
                  </h1>
                )}
                {editMode ? (
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-2 max-w-lg text-sm"
                    placeholder="Add a description..."
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedTemplate.description || 'No description'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit}>
                      <Save className="w-4 h-4 mr-1" />
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleStartEdit}>
                      <Edit3 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyTemplate(selectedTemplate)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => setDeleteConfirm(selectedTemplate)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </header>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto p-6">
              {editMode && (
                <div className="mb-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setAddSectionDialog(true)}
                    className="w-full border-dashed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Section
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {(editMode ? editSections : selectedTemplate.sections || []).map((section, sectionIndex) => (
                  <Card key={section.id} className="overflow-hidden">
                    <CardHeader 
                      className={`py-3 px-4 bg-gray-50 cursor-pointer ${editMode ? 'hover:bg-gray-100' : ''}`}
                      onClick={() => toggleSectionExpand(section.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {editMode && (
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                          )}
                          <span className="text-lg">{getSectionIcon(section.name)}</span>
                          <CardTitle className="text-base font-medium">
                            {section.name}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {section.items?.length || 0} items
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {editMode && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveSection(section.id)
                              }}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {expandedSections.has(section.id) 
                            ? <ChevronDown className="w-5 h-5 text-gray-400" />
                            : <ChevronRight className="w-5 h-5 text-gray-400" />
                          }
                        </div>
                      </div>
                    </CardHeader>

                    {expandedSections.has(section.id) && (
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {section.items?.map((item, itemIndex) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between p-3 hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-3">
                                {editMode && (
                                  <GripVertical className="w-4 h-4 text-gray-300" />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.name}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-gray-500">{item.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.isRequired && (
                                  <Badge variant="outline" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                {editMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(section.id, item.id)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}

                          {editMode && (
                            <div className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAddItemDialog({ sectionId: section.id })}
                                className="w-full text-gray-500 hover:text-gray-700"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Item
                              </Button>
                            </div>
                          )}

                          {(!section.items || section.items.length === 0) && !editMode && (
                            <div className="p-4 text-center text-sm text-gray-500">
                              No items in this section
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>

              {((editMode ? editSections : selectedTemplate.sections) || []).length === 0 && (
                <div className="text-center py-12">
                  <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No sections yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Add sections to organize your FFE items
                  </p>
                  {editMode && (
                    <Button onClick={() => setAddSectionDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Section
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <LayoutTemplate className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-900 mb-2">
                Select a template
              </h2>
              <p className="text-gray-500 mb-4">
                Choose a template from the sidebar or create a new one
              </p>
              <Button onClick={() => setCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Create Template Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a new FFE template to organize your sourcing workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Master Bedroom Template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDescription">Description (optional)</Label>
              <Textarea
                id="templateDescription"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Describe what this template is for..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={!newTemplateName.trim()}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={addSectionDialog} onOpenChange={setAddSectionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Choose a section type to add to your template.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-4 max-h-[400px] overflow-y-auto">
            {DEFAULT_SECTIONS.map(section => (
              <button
                key={section.name}
                onClick={() => handleAddSection(section.name)}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 hover:border-purple-200 transition-colors text-left"
              >
                <span className="text-2xl">{section.icon}</span>
                <div>
                  <p className="font-medium text-gray-900">{section.name}</p>
                  <p className="text-xs text-gray-500">{section.description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={!!addItemDialog} onOpenChange={() => setAddItemDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Add a new item to this section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Bedside Table"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemDescription">Description (optional)</Label>
              <Input
                id="itemDescription"
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="itemRequired"
                checked={newItemRequired}
                onChange={(e) => setNewItemRequired(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="itemRequired" className="text-sm">
                This item is required
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={!newItemName.trim()}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
