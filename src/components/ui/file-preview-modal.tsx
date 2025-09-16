'use client'

import React from 'react'
import { X, Download, ExternalLink, Eye, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from './button'

interface FilePreviewModalProps {
  file: {
    id: string
    name: string
    originalName: string
    type: 'image' | 'pdf' | 'document'
    url: string
    size: number
    uploadedAt: string
    uploadedBy: {
      name: string
    }
    metadata?: {
      sizeFormatted: string
      extension: string
      isImage: boolean
      isPDF: boolean
    }
  }
  isOpen: boolean
  onClose: () => void
}

export default function FilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  if (!isOpen) return null

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenExternal = () => {
    window.open(file.url, '_blank')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileIcon = () => {
    switch (file.type) {
      case 'image':
        return <ImageIcon className="w-6 h-6" />
      case 'pdf':
        return <FileText className="w-6 h-6" />
      default:
        return <FileText className="w-6 h-6" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-75 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              {getFileIcon()}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 truncate max-w-sm">
                {file.originalName}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                <span>{file.metadata?.sizeFormatted || `${(file.size / 1024).toFixed(1)} KB`}</span>
                <span>•</span>
                <span>Uploaded by {file.uploadedBy.name}</span>
                <span>•</span>
                <span>{formatDate(file.uploadedAt)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenExternal}
              className="flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <div className="relative overflow-auto max-h-[70vh]">
          {file.type === 'image' ? (
            <div className="flex items-center justify-center p-6 min-h-[400px] bg-gray-50">
              <img
                src={file.url}
                alt={file.originalName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                style={{ maxHeight: '60vh' }}
              />
            </div>
          ) : file.type === 'pdf' ? (
            <div className="w-full h-[70vh]">
              <iframe
                src={`${file.url}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border-0"
                title={file.originalName}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 min-h-[400px]">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-500" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Preview not available
              </h4>
              <p className="text-gray-600 mb-6">
                This file type cannot be previewed in the browser.
              </p>
              <div className="flex space-x-3">
                <Button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-700">
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
                <Button variant="outline" onClick={handleOpenExternal}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Externally
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>File Preview</span>
              </span>
              {file.metadata?.extension && (
                <span className="px-2 py-1 bg-gray-200 rounded-md text-xs font-medium">
                  {file.metadata.extension.toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="text-xs text-gray-500">
              Press ESC to close
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for keyboard navigation
export function useFilePreview() {
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // This will be handled by the component using this hook
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])
}