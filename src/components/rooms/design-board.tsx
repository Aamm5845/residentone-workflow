'use client'

import React from 'react'
import { Upload, Plus, MessageSquare, Image, FileText, Link as LinkIcon, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import FilePreviewModal from '@/components/ui/file-preview-modal'

interface DesignBoardProps {
  section: {
    id: string
    name: string
    icon: string
  }
  roomId: string
  projectId?: string
}

interface FileData {
  id: string
  name: string
  originalName?: string
  type: 'image' | 'pdf' | 'document'
  url: string
  size?: number
  uploadedAt: Date | string
  uploadedBy?: {
    id: string
    name: string
  }
  metadata?: {
    sizeFormatted: string
    extension: string
    isImage: boolean
    isPDF: boolean
  }
}

interface MessageData {
  id: string
  message: string
  createdAt: string
  author: {
    id: string
    name: string
    role: string
  }
  sectionId: string
  roomId: string
}

export default function DesignBoard({ section, roomId, projectId }: DesignBoardProps) {
  const [files, setFiles] = React.useState<FileData[]>([
    { 
      id: '1', 
      name: 'Hardwood Sample', 
      originalName: 'hardwood-oak-sample.jpg',
      type: 'image', 
      url: '/api/placeholder/300/200', 
      uploadedAt: new Date(),
      size: 245760,
      uploadedBy: { id: 'user1', name: 'Sarah Designer' },
      metadata: {
        sizeFormatted: '240 KB',
        extension: '.jpg',
        isImage: true,
        isPDF: false
      }
    },
    { 
      id: '2', 
      name: 'Paint Color Palette', 
      originalName: 'color-palette-2024.pdf',
      type: 'pdf', 
      url: '/api/placeholder/300/200', 
      uploadedAt: new Date(),
      size: 1024000,
      uploadedBy: { id: 'user2', name: 'Design Team' },
      metadata: {
        sizeFormatted: '1.0 MB',
        extension: '.pdf',
        isImage: false,
        isPDF: true
      }
    },
  ])
  const [messages, setMessages] = React.useState<MessageData[]>([])
  const [newMessage, setNewMessage] = React.useState('')
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [showMessages, setShowMessages] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [previewFile, setPreviewFile] = React.useState<FileData | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load messages on component mount
  React.useEffect(() => {
    fetch(`/api/messages?sectionId=${section.id}&roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMessages(data.messages)
        }
      })
      .catch(err => console.error('Failed to load messages:', err))
  }, [section.id, roomId])

  // Handle ESC key for closing preview modal
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && previewFile) {
        setPreviewFile(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [previewFile])

  const handleFileUpload = async (file: File) => {
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      // File validation on client side
      const maxSize = 10 * 1024 * 1024 // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`)
      }
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`)
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('sectionId', section.id)
      formData.append('roomId', roomId)
      if (projectId) formData.append('projectId', projectId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (result.success) {
        setFiles(prev => [...prev, result.file])
        setUploadProgress(100)
        
        // Show success notification
        const notification = document.createElement('div')
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        notification.textContent = `✓ ${file.name} uploaded successfully`
        document.body.appendChild(notification)
        
        setTimeout(() => {
          document.body.removeChild(notification)
        }, 3000)
      } else {
        throw new Error(result.details || result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      
      // Show error notification
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm'
      notification.innerHTML = `
        <div class="font-semibold">⚠️ Upload Failed</div>
        <div class="text-sm mt-1">${error instanceof Error ? error.message : 'Please try again.'}</div>
      `
      document.body.appendChild(notification)
      
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 5000)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0]) // Handle first file only
    }
  }

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage,
          sectionId: section.id,
          roomId: roomId
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setMessages(prev => [...prev, result.message])
        setNewMessage('')
      } else {
        alert('Failed to post message: ' + result.error)
      }
    } catch (error) {
      console.error('Message error:', error)
      alert('Failed to post message. Please try again.')
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />
      case 'pdf': return <FileText className="w-4 h-4" />
      case 'link': return <LinkIcon className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">{section.icon}</span>
            <h4 className="font-semibold text-gray-900">{section.name}</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={handleUploadClick} disabled={isUploading}>
            {isUploading ? <span className="animate-spin">⏳</span> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept="image/*,.pdf,.webp"
          className="hidden"
        />
        
        {/* Upload Area */}
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
            dragOver 
              ? 'border-purple-400 bg-purple-50' 
              : isUploading 
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-purple-300'
          }`}
          onClick={handleUploadClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${
            dragOver ? 'text-purple-500' : isUploading ? 'text-blue-500 animate-pulse' : 'text-gray-400'
          }`} />
          
          <p className="text-sm font-medium text-gray-600">
            {isUploading 
              ? 'Uploading...' 
              : dragOver 
              ? 'Drop file here' 
              : 'Drop files here or click to upload'}
          </p>
          
          <p className="text-xs text-gray-500 mt-1">
            {isUploading 
              ? 'Please wait while your file uploads' 
              : 'Images (JPG, PNG, WebP), PDFs - Max 10MB'}
          </p>
          
          {/* Progress Bar */}
          {isUploading && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-1">{uploadProgress}% complete</p>
            </div>
          )}
        </div>
        
        {/* File Grid */}
        <div className="grid grid-cols-2 gap-3">
          {files.map((file) => (
            <div 
              key={file.id} 
              className="group bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.02]"
              onClick={() => setPreviewFile(file)}
            >
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                {file.type === 'image' ? (
                  <img 
                    src={file.url} 
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    {getFileIcon(file.type)}
                  </div>
                )}
                
                {/* Preview overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <Eye className="w-4 h-4 text-gray-700" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-2">
                <p className="text-xs font-medium text-gray-900 truncate" title={file.originalName || file.name}>
                  {file.originalName || file.name}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                  <span>{formatDate(file.uploadedAt)}</span>
                  {file.metadata?.sizeFormatted && (
                    <span className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                      {file.metadata.sizeFormatted}
                    </span>
                  )}
                </div>
                {file.uploadedBy && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    by {file.uploadedBy.name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Messages Section */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Messages ({messages.length})</span>
            <Button variant="ghost" size="sm" onClick={() => setShowMessages(!showMessages)}>
              <MessageSquare className="w-4 h-4" />
            </Button>
          </div>
          
          {showMessages && (
            <div className="space-y-3">
              {/* Message List */}
              <div className="max-h-40 overflow-y-auto space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className="text-sm p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">{msg.author.name}</div>
                    <div className="text-gray-700">{msg.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add Message */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMessage()}
                />
                <Button size="sm" onClick={handleAddMessage}>
                  Post
                </Button>
              </div>
            </div>
          )}
          
          {!showMessages && (
            <div className="text-sm text-gray-500">
              {messages.length === 0 ? 'No messages yet. Click to add a comment.' : `${messages.length} message${messages.length !== 1 ? 's' : ''}. Click to view.`}
            </div>
          )}
        </div>
      </div>
      
      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={{
            ...previewFile,
            originalName: previewFile.originalName || previewFile.name,
            uploadedAt: typeof previewFile.uploadedAt === 'string' 
              ? previewFile.uploadedAt 
              : previewFile.uploadedAt.toISOString(),
            uploadedBy: previewFile.uploadedBy || { name: 'Unknown User' },
            size: previewFile.size || 0
          }}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}
