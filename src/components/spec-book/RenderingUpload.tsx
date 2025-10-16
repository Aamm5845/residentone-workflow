'use client'

import React, { useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDropzone } from 'react-dropzone'

interface RenderingUploadProps {
  roomId: string
}

interface UploadedRendering {
  id: string
  url: string
  filename: string
  size: number
}

export function RenderingUpload({ roomId }: RenderingUploadProps) {
  const [renderings, setRenderings] = useState<UploadedRendering[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Load existing renderings on mount
  React.useEffect(() => {
    loadExistingRenderings()
  }, [roomId])

  const loadExistingRenderings = async () => {
    try {
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      const result = await response.json()
      
      if (result.success && result.renderings) {
        setRenderings(result.renderings.map((r: any) => ({
          id: r.id,
          url: r.imageUrl,
          filename: r.filename || 'rendering.jpg',
          size: r.fileSize || 0
        })))
      }
    } catch (error) {
      console.error('Error loading existing renderings:', error)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true)
    
    try {
      for (const file of acceptedFiles) {
        // Upload to Vercel Blob via API
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'rendering')
        formData.append('roomId', roomId)
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData
        })
        
        const uploadResult = await uploadResponse.json()
        
        if (uploadResult.success) {
          const newRendering: UploadedRendering = {
            id: uploadResult.renderingId,
            url: uploadResult.url,
            filename: file.name,
            size: file.size
          }
          
          setRenderings(prev => [...prev, newRendering])
          
          // Update spec book section with rendering URL
          await updateRenderingUrl(uploadResult.url)
        } else {
          throw new Error(uploadResult.error || 'Upload failed')
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
    }
  }, [roomId])

  const updateRenderingUrl = async (imageUrl: string) => {
    try {
      await fetch('/api/spec-books/room-renderings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId,
          imageUrl
        })
      })
    } catch (error) {
      console.error('Error updating rendering URL:', error)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    multiple: true,
    disabled: isUploading
  })

  const handleRemoveRendering = async (renderingId: string) => {
    try {
      const response = await fetch('/api/spec-books/room-renderings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ renderingId })
      })
      
      if (response.ok) {
        setRenderings(prev => prev.filter(r => r.id !== renderingId))
      } else {
        throw new Error('Failed to delete rendering')
      }
    } catch (error) {
      console.error('Error removing rendering:', error)
      alert('Failed to remove rendering')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Rendering Images</h4>
      
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-gray-400" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive 
                  ? 'Drop rendering images here'
                  : 'Upload rendering images'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Drag & drop or click to select • JPG, PNG, WebP
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Renderings */}
      {renderings.length > 0 && (
        <div className="space-y-2">
          {renderings.map((rendering) => (
            <div key={rendering.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={rendering.url}
                    alt={rendering.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{rendering.filename}</div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(rendering.size)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRendering(rendering.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {renderings.length === 0 && !isUploading && (
        <div className="text-sm text-gray-500 text-center py-4 border border-dashed rounded">
          No rendering images uploaded yet
        </div>
      )}
    </div>
  )
}