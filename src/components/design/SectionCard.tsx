'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2,
  Edit,
  Upload,
  FileText,
  MessageSquare,
  CheckSquare,
  Square,
  Tag,
  X,
  Paperclip,
  Image as ImageIcon,
  Link as LinkIcon,
  Save
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

// Import existing components
import { UploadZone } from './UploadZone'
import { NotesFeed } from './NotesFeed'

// Enhanced interfaces
interface SectionDefinition {
  id: string
  name: string
  icon: string
  color: string
  description: string
  placeholder: string
}

interface ChecklistItem {
  id: string
  title: string
  description?: string
  completed: boolean
  order: number
  createdAt: string
}

interface Asset {
  id: string
  title: string
  url: string
  type: string
  userDescription?: string
  createdAt: string
  thumbnail?: string
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    role: string
  }
}

interface DesignSection {
  id: string
  type: string
  content?: string
  completed: boolean
  createdAt: string
  updatedAt: string
  assets: Asset[]
  comments: Comment[]
  checklistItems: ChecklistItem[]
}

interface SectionCardProps {
  sectionDef: SectionDefinition
  section?: DesignSection
  stageId: string
  isExpanded: boolean
  onToggleExpand: () => void
  onDataChange: () => void
  isStageCompleted: boolean
}

export function SectionCard({ 
  sectionDef, 
  section, 
  stageId,
  isExpanded, 
  onToggleExpand, 
  onDataChange,
  isStageCompleted 
}: SectionCardProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'assets' | 'notes' | 'checklist'>('content')
  const [editingContent, setEditingContent] = useState(false)
  const [contentText, setContentText] = useState(section?.content || '')
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [showAddChecklist, setShowAddChecklist] = useState(false)

  const hasContent = section?.content && section.content.trim().length > 0
  const assetCount = section?.assets?.length || 0
  const commentCount = section?.comments?.length || 0
  const checklistItems = section?.checklistItems?.length || 0
  const completedChecklist = section?.checklistItems?.filter(item => item.completed).length || 0
  const completionPercentage = checklistItems > 0 ? Math.round((completedChecklist / checklistItems) * 100) : 0

  // Save content
  const handleSaveContent = async () => {
    if (!section?.id) return

    try {
      const response = await fetch(`/api/design/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentText })
      })

      if (response.ok) {
        setEditingContent(false)
        onDataChange()
        toast.success('Content saved')
      }
    } catch (error) {
      toast.error('Failed to save content')
    }
  }

  // Toggle section completion
  const handleToggleCompletion = async () => {
    if (!section?.id) return

    try {
      const response = await fetch(`/api/design/sections/${section.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !section.completed })
      })

      if (response.ok) {
        onDataChange()
        toast.success(section.completed ? 'Section marked incomplete' : 'Section completed!')
      }
    } catch (error) {
      toast.error('Failed to update section')
    }
  }

  // Add checklist item
  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim() || !section?.id) return

    try {
      const response = await fetch(`/api/design/sections/${section.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newChecklistItem.trim(),
          order: checklistItems
        })
      })

      if (response.ok) {
        setNewChecklistItem('')
        setShowAddChecklist(false)
        onDataChange()
        toast.success('Checklist item added')
      }
    } catch (error) {
      toast.error('Failed to add checklist item')
    }
  }

  // Toggle checklist item
  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/design/checklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed })
      })

      if (response.ok) {
        onDataChange()
      }
    } catch (error) {
      toast.error('Failed to update checklist item')
    }
  }

  // Delete checklist item
  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!confirm('Delete this checklist item?')) return

    try {
      const response = await fetch(`/api/design/checklist/${itemId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onDataChange()
        toast.success('Checklist item deleted')
      }
    } catch (error) {
      toast.error('Failed to delete checklist item')
    }
  }

  // Delete asset
  const handleDeleteAsset = async (assetId: string, assetTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${assetTitle}"?`)) return

    try {
      const response = await fetch(`/api/design/upload?assetId=${assetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onDataChange()
        toast.success('Asset deleted')
      } else {
        throw new Error('Failed to delete asset')
      }
    } catch (error) {
      toast.error('Failed to delete asset')
    }
  }

  return (
    <div className={`border-2 rounded-xl transition-all duration-200 ${
      section?.completed 
        ? 'border-green-400 bg-green-50/30' 
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      {/* Section Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Expand/Collapse Button */}
            <button
              onClick={onToggleExpand}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {/* Section Icon */}
            <div className={`w-12 h-12 bg-gradient-to-br ${sectionDef.color} rounded-xl flex items-center justify-center text-white text-xl shadow-lg`}>
              {sectionDef.icon}
            </div>
            
            {/* Section Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className={`text-lg font-bold ${
                  section?.completed ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {sectionDef.name}
                </h3>
                
                {/* Status Indicators */}
                <div className="flex items-center space-x-1.5">
                  {hasContent && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      Content
                    </span>
                  )}
                  {assetCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                      <Paperclip className="w-3 h-3 mr-1" />
                      {assetCount}
                    </span>
                  )}
                  {commentCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {commentCount}
                    </span>
                  )}
                  {checklistItems > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      <CheckSquare className="w-3 h-3 mr-1" />
                      {completedChecklist}/{checklistItems}
                    </span>
                  )}
                </div>
              </div>
              <p className={`text-sm ${
                section?.completed ? 'text-green-600' : 'text-gray-600'
              }`}>
                {sectionDef.description}
              </p>
              {/* Progress bar for checklist */}
              {checklistItems > 0 && (
                <div className="mt-2">
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                    <span>Progress: {completionPercentage}%</span>
                  </div>
                  <div className="w-32 bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Completion Toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleToggleCompletion}
              disabled={isStageCompleted}
              className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-110 ${
                section?.completed 
                  ? 'bg-green-500 border-green-500 text-white shadow-lg' 
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              {section?.completed && (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </button>
            
            <span className={`text-sm font-bold ${
              section?.completed ? 'text-green-700' : 'text-gray-500'
            }`}>
              {section?.completed ? 'Complete' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Tab Navigation */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex space-x-1">
              {[
                { id: 'content', label: 'Content', icon: FileText },
                { id: 'assets', label: 'Assets', icon: Paperclip },
                { id: 'notes', label: 'Notes', icon: MessageSquare },
                { id: 'checklist', label: 'Checklist', icon: CheckSquare }
              ].map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id 
                        ? 'bg-white text-purple-700 shadow-sm border border-gray-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.id === 'assets' && assetCount > 0 && (
                      <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{assetCount}</span>
                    )}
                    {tab.id === 'notes' && commentCount > 0 && (
                      <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{commentCount}</span>
                    )}
                    {tab.id === 'checklist' && checklistItems > 0 && (
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{checklistItems}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Section Content</h4>
                  {!editingContent && (
                    <Button
                      onClick={() => setEditingContent(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>

                {editingContent ? (
                  <div className="space-y-3">
                    <textarea
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      placeholder={sectionDef.placeholder}
                      className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="flex items-center space-x-2">
                      <Button onClick={handleSaveContent} size="sm">
                        <Save className="w-4 h-4 mr-1" />
                        Save Content
                      </Button>
                      <Button 
                        onClick={() => {
                          setEditingContent(false)
                          setContentText(section?.content || '')
                        }} 
                        variant="outline" 
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[100px] p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {hasContent ? (
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-900 whitespace-pre-wrap">{section?.content}</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 mb-2">No content added yet</p>
                        <p className="text-sm text-gray-500">{sectionDef.placeholder}</p>
                        <Button
                          onClick={() => setEditingContent(true)}
                          variant="outline"
                          size="sm"
                          className="mt-3"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Content
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assets Tab */}
            {activeTab === 'assets' && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Assets & References</h4>
                {section?.id ? (
                  <UploadZone
                    sectionId={section.id}
                    onUploadComplete={onDataChange}
                    onUploadError={(error) => toast.error(error)}
                    disabled={isStageCompleted}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Section needs to be created first</p>
                  </div>
                )}

                {/* Asset List */}
                {assetCount > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    {section?.assets.map(asset => (
                      <div key={asset.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            {asset.type === 'image' || asset.type === 'IMAGE' ? (
                              <ImageIcon className="w-5 h-5 text-gray-500" />
                            ) : (
                              <FileText className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-gray-900 truncate">{asset.title}</h5>
                            {asset.userDescription && (
                              <p className="text-sm text-gray-600 mt-1">{asset.userDescription}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => window.open(asset.url, '_blank')}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View asset"
                            >
                              <LinkIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset.id, asset.title)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete asset"
                              disabled={isStageCompleted}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Notes & Comments</h4>
                {section?.id ? (
                  <NotesFeed
                    sectionId={section.id}
                    notes={section.comments || []}
                    onNotesUpdate={onDataChange}
                  />
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Section needs to be created first</p>
                  </div>
                )}
              </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Task Checklist</h4>
                  <Button
                    onClick={() => setShowAddChecklist(true)}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Task
                  </Button>
                </div>

                {/* Add new checklist item */}
                {showAddChecklist && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        placeholder="Enter task description..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                      />
                      <div className="flex items-center space-x-2">
                        <Button onClick={handleAddChecklistItem} size="sm">
                          Add Task
                        </Button>
                        <Button 
                          onClick={() => {
                            setShowAddChecklist(false)
                            setNewChecklistItem('')
                          }} 
                          variant="outline" 
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Checklist Items */}
                {checklistItems > 0 ? (
                  <div className="space-y-2">
                    {section?.checklistItems
                      ?.sort((a, b) => a.order - b.order)
                      .map(item => (
                      <div key={item.id} className="flex items-start space-x-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                        <button
                          onClick={() => handleToggleChecklistItem(item.id, item.completed)}
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            item.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {item.completed && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            item.completed ? 'text-green-700 line-through' : 'text-gray-900'
                          }`}>
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 mb-2">No tasks added yet</p>
                    <p className="text-sm text-gray-500 mb-4">Create a checklist to track your progress</p>
                    <Button
                      onClick={() => setShowAddChecklist(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Task
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
