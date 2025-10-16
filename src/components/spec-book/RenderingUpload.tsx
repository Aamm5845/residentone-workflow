'use client'

import { useState, useCallback } from 'react'
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true)
    
    try {
      for (const file of acceptedFiles) {
        // TODO: Implement actual file upload to Vercel Blob
        // This would call /api/upload with the file
        
        // Mock upload for now
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const newRendering: UploadedRendering = {
          id: Math.random().toString(36),
          url: URL.createObjectURL(file),
          filename: file.name,
          size: file.size
        }
        
        setRenderings(prev => [...prev, newRendering])
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    multiple: true,
    disabled: isUploading
  })

  const handleRemoveRendering = (renderingId: string) => {
    setRenderings(prev => prev.filter(r => r.id !== renderingId))
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