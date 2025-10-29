'use client'

import React, { useEffect, useState } from 'react'
import { X, Download, ExternalLink, Eye, FileText, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
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

export default function EnhancedFilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  
  // Reset state when file changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setImageLoaded(false)
      setImageError(false)
      setZoom(1)
      setRotation(0)
    }
  }, [isOpen, file.id])

  if (!isOpen) return null

  const handleDownload = () => {
    try {
      // Create a download link
      const link = document.createElement('a')
      link.href = file.url
      link.download = file.originalName || file.name
      
      // For debugging

      // Append to body, click, and clean up
      document.body.appendChild(link)
      link.click()
      
      // Give browser time to start the download before removing
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download file. Please try again.')
    }
  }

  const handleOpenExternal = () => {
    try {
      // For debugging
      
      window.open(file.url, '_blank')
    } catch (error) {
      console.error('Open external error:', error)
      alert('Failed to open file in new tab. Please try again.')
    }
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
  
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const rotateImage = () => setRotation(prev => (prev + 90) % 360)

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageLoaded(false)
    setImageError(true)
    console.error('Failed to load image:', file.url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-75 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-5xl max-h-[95vh] w-full mx-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              {getFileIcon()}
            </div>
            <div className="max-w-lg overflow-hidden">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {file.originalName || file.name}
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
        <div className="relative overflow-auto flex-grow bg-gray-50 min-h-[200px]">
          {file.type === 'image' ? (
            <div className="flex flex-col items-center justify-center p-6 min-h-[400px] bg-gray-50">
              {/* Image controls */}
              <div className="absolute top-4 right-4 flex space-x-2 z-10 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-1">
                <Button variant="ghost" size="sm" onClick={zoomIn} title="Zoom In">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={zoomOut} title="Zoom Out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={rotateImage} title="Rotate">
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Loading indicator */}
              {!imageLoaded && !imageError && (
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                  <p className="text-gray-500 mt-4">Loading image...</p>
                </div>
              )}
              
              {/* Error state */}
              {imageError && (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-red-500" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Failed to load image
                  </h4>
                  <p className="text-gray-600 mb-6 max-w-md">
                    The image could not be loaded. It may be unavailable or the URL might be incorrect.
                  </p>
                  <div className="flex space-x-4">
                    <Button 
                      onClick={handleOpenExternal}
                      variant="outline"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Try opening externally
                    </Button>
                    <Button 
                      onClick={handleDownload}
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download directly
                    </Button>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">
                    URL: <span className="font-mono text-xs break-all">{file.url}</span>
                  </p>
                </div>
              )}
              
              {/* Actual image with zoom and rotation */}
              <img
                src={file.url}
                alt={file.originalName || file.name}
                className={`max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease',
                  maxHeight: '70vh',
                  cursor: 'grab'
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              
              {/* Image details when loaded */}
              {imageLoaded && (
                <div className="mt-4 text-sm text-gray-500">
                  {file.metadata?.extension && (
                    <span className="bg-gray-100 px-2 py-1 rounded-md">{file.metadata.extension.toUpperCase()}</span>
                  )}
                </div>
              )}
            </div>
          ) : file.type === 'pdf' ? (
            <div className="w-full h-[70vh]">
              <iframe
                src={`${file.url}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border-0"
                title={file.originalName || file.name}
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
                <Button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-700 text-white">
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
