'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Upload, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Calendar,
  User,
  Plus,
  X,
  FileImage,
  FileText,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Eye,
  Edit3,
  Save,
  Target
} from 'lucide-react'

interface DesignStageProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
  onReopen?: () => void
  onAddComment: (sectionId: string, content: string, mentions: string[]) => void
  onUploadFile: (sectionId: string, file: File) => void
  onUpdateSection: (sectionId: string, content: string) => void
}

const DESIGN_SECTIONS = [
  {
    id: 'FURNITURE',
    name: 'Furniture & Layout',
    description: 'Furniture selection, placement, and room layout planning',
    icon: '🪑',
    color: 'bg-blue-500'
  },
  {
    id: 'LIGHTING',
    name: 'Lighting Design',
    description: 'Ambient, task, and accent lighting planning',
    icon: '💡',
    color: 'bg-yellow-500'
  },
  {
    id: 'WALLS',
    name: 'Wall Treatments & Molding',
    description: 'Paint, wallcoverings, molding, and architectural details',
    icon: '🎨',
    color: 'bg-purple-500'
  },
  {
    id: 'GENERAL',
    name: 'General Design',
    description: 'Overall design concept, mood, and styling direction',
    icon: '✨',
    color: 'bg-green-500'
  }
]

export default function DesignStage({ 
  stage, 
  room, 
  project, 
  onComplete, 
  onReopen,
  onAddComment, 
  onUploadFile, 
  onUpdateSection 
}: DesignStageProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['FURNITURE']))
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set())
  const [sectionContent, setSectionContent] = useState<Record<string, string>>({})
  const [newComment, setNewComment] = useState('')
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate overall progress
  const completedSections = stage.designSections?.filter((s: any) => s.content && s.content.length > 50) || []
  const progress = (completedSections.length / DESIGN_SECTIONS.length) * 100

  const isStageComplete = progress === 100 && stage.status === 'IN_PROGRESS'

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const startEditing = (sectionId: string, currentContent: string = '') => {
    setEditingSections(new Set([...editingSections, sectionId]))
    setSectionContent({ ...sectionContent, [sectionId]: currentContent })
  }

  const saveSection = async (sectionId: string) => {
    const content = sectionContent[sectionId] || ''
    if (content.trim()) {
      await onUpdateSection(sectionId, content)
      const newEditing = new Set(editingSections)
      newEditing.delete(sectionId)
      setEditingSections(newEditing)
    }
  }

  const handleFileUpload = async (sectionId: string, file: File) => {
    setUploadingFiles(new Set([...uploadingFiles, sectionId]))
    try {
      await onUploadFile(sectionId, file)
    } finally {
      const newUploading = new Set(uploadingFiles)
      newUploading.delete(sectionId)
      setUploadingFiles(newUploading)
    }
  }

  const handleAddComment = () => {
    if (newComment.trim() && selectedSection) {
      // Extract mentions from comment (simple @username parsing)
      const mentions = newComment.match(/@[\w]+/g) || []
      onAddComment(selectedSection, newComment, mentions)
      setNewComment('')
    }
  }

  const getSectionProgress = (sectionId: string) => {
    const section = stage.designSections?.find((s: any) => s.type === sectionId)
    if (!section) return 0
    
    // Calculate progress based on content length, files, and comments
    let progress = 0
    if (section.content && section.content.length > 50) progress += 60
    if (section.assets && section.assets.length > 0) progress += 30
    if (section.comments && section.comments.length > 0) progress += 10
    
    return Math.min(progress, 100)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Stage Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Design Stage</h2>
              <p className="text-gray-600">{room.name || room.type} - {project.name}</p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <User className="w-4 h-4 mr-1" />
                  {stage.assignedUser?.name || 'Unassigned'}
                </div>
                {stage.dueDate && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    Due {new Date(stage.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{Math.round(progress)}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
            
            {isStageComplete && stage.status !== 'COMPLETED' && (
              <Button 
                onClick={onComplete}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            )}
            
            {stage.status === 'COMPLETED' && (
              <Button 
                onClick={() => onReopen && onReopen()}
                variant="outline"
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Reopen for Editing
              </Button>
            )}
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stage Status Alert */}
        {isStageComplete && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-800">
                All sections complete! Ready to proceed to 3D Rendering stage.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Design Sections */}
      <div className="p-6 space-y-6">
        {DESIGN_SECTIONS.map((sectionDef) => {
          const section = stage.designSections?.find((s: any) => s.type === sectionDef.id)
          const sectionProgress = getSectionProgress(sectionDef.id)
          const isExpanded = expandedSections.has(sectionDef.id)
          const isEditing = editingSections.has(sectionDef.id)
          const isUploading = uploadingFiles.has(sectionDef.id)

          return (
            <div key={sectionDef.id} className="border border-gray-200 rounded-lg">
              {/* Section Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection(sectionDef.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    
                    <div className={`w-10 h-10 ${sectionDef.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                      {sectionDef.icon}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900">{sectionDef.name}</h3>
                      <p className="text-sm text-gray-600">{sectionDef.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{Math.round(sectionProgress)}%</div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${sectionDef.color} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${sectionProgress}%` }}
                        />
                      </div>
                    </div>
                    
                    {sectionProgress === 100 && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Section Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Content Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">Design Details</label>
                      {!isEditing ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => startEditing(sectionDef.id, section?.content || '')}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const newEditing = new Set(editingSections)
                              newEditing.delete(sectionDef.id)
                              setEditingSections(newEditing)
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => saveSection(sectionDef.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {isEditing ? (
                      <textarea
                        value={sectionContent[sectionDef.id] || ''}
                        onChange={(e) => setSectionContent({
                          ...sectionContent,
                          [sectionDef.id]: e.target.value
                        })}
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        placeholder={`Add detailed ${sectionDef.name.toLowerCase()} specifications...`}
                      />
                    ) : (
                      <div className="min-h-[80px] p-3 bg-gray-50 rounded-md">
                        {section?.content ? (
                          <div>
                            <p className="text-gray-800 whitespace-pre-wrap">{section.content}</p>
                            {section.updatedAt && (
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <span className="text-xs text-gray-500">
                                  Last updated: {new Date(section.updatedAt).toLocaleDateString()} at {new Date(section.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">No details added yet. Click Edit to add content.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* File Upload Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">Reference Images & Files</label>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Clock className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-1" />
                        )}
                        Upload Files
                      </Button>
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files
                        if (files) {
                          Array.from(files).forEach(file => {
                            handleFileUpload(sectionDef.id, file)
                          })
                        }
                      }}
                    />
                    
                    {/* Uploaded Files Display */}
                    <div className="space-y-3">
                      {section?.assets?.map((asset: any) => (
                        <div key={asset.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {asset.type === 'IMAGE' ? (
                                <img 
                                  src={asset.url} 
                                  alt={asset.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-900 truncate">{asset.title}</h4>
                                <button className="text-blue-600 hover:text-blue-700">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="text-xs text-gray-500">
                                  {new Date(asset.createdAt).toLocaleDateString()} at {new Date(asset.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {asset.size && (
                                  <span className="text-xs text-gray-500">
                                    {(asset.size / 1024 / 1024).toFixed(1)} MB
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 capitalize">
                                  {asset.type.toLowerCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Upload Placeholder */}
                      <div 
                        className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <Plus className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500">Add Files</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Comments & Notes</label>
                    
                    {/* Existing Comments */}
                    <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                      {section?.comments?.map((comment: any) => (
                        <div key={comment.id} className="flex space-x-3">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">{comment.author?.name}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Add Comment */}
                    <div className="flex space-x-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={selectedSection === sectionDef.id ? newComment : ''}
                          onChange={(e) => {
                            setSelectedSection(sectionDef.id)
                            setNewComment(e.target.value)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                          rows={2}
                          placeholder="Add a comment... Use @username to mention team members"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            Tip: Use @aaron, @vitor, @sammy, @shaya to mention team members
                          </span>
                          <Button 
                            size="sm"
                            onClick={handleAddComment}
                            disabled={!newComment.trim() || selectedSection !== sectionDef.id}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Comment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Timeline & Due Dates */}
      <div className="p-6 border-t border-gray-100 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Timeline & Milestones</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Stage Started</span>
            <span className="text-xs text-gray-500">
              {new Date(stage.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          {stage.dueDate && (
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Due Date</span>
              <span className="text-xs text-gray-500">
                {new Date(stage.dueDate).toLocaleDateString()}
              </span>
            </div>
          )}
          
          {isStageComplete && (
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Next: 3D Rendering (Vitor will be notified)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
