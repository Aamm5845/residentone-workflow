'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { 
  Upload, 
  File, 
  Image, 
  X, 
  AlertCircle, 
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface UploadZoneProps {
  sectionId: string
  onUploadComplete: (asset: any) => void
  onUploadError: (error: string) => void
  disabled?: boolean
  maxFiles?: number
  className?: string
  stageId?: string
  sectionType?: string
  onResolveSectionId?: (sectionType: string) => Promise<string>
}

interface FileUpload {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'complete' | 'error'
  progress: number
  error?: string
  description?: string
}

export function UploadZone({ 
  sectionId, 
  onUploadComplete, 
  onUploadError, 
  disabled = false,
  maxFiles = 10,
  className = '',
  stageId,
  sectionType,
  onResolveSectionId
}: UploadZoneProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // Fix hydration mismatch by only rendering after client-side mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // File validation
  const validateFile = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'application/pdf'
    ]

    if (file.size > maxSize) {
      return `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`
    }

    if (!allowedTypes.includes(file.type)) {
      return `File type not supported. Allowed types: JPG, PNG, WebP, PDF`
    }

    return null
  }

  // Handle file drop/selection
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return

    const validFiles: File[] = []
    const errors: string[] = []

    // Validate each file
    acceptedFiles.forEach(file => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push(file)
      }
    })

    // Show errors if any
    if (errors.length > 0) {
      toast.error('Some files were rejected', {
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n+${errors.length - 3} more` : '')
      })
    }

    // Check file limit
    if (uploads.length + validFiles.length > maxFiles) {
      toast.error(`Cannot upload more than ${maxFiles} files`)
      return
    }

    // Add valid files to upload queue
    const newUploads: FileUpload[] = validFiles.map(file => ({
      id: `${Date.now()}-${file.name}`,
      file,
      status: 'pending',
      progress: 0,
      description: ''
    }))

    setUploads(prev => [...prev, ...newUploads])
    
    // Start uploading
    if (newUploads.length > 0) {
      startUploads(newUploads)
    }
  }, [disabled, uploads.length, maxFiles, sectionId])

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled,
    multiple: true
  })

  // Upload files
  const startUploads = async (fileUploads: FileUpload[]) => {
    setIsUploading(true)

    for (const upload of fileUploads) {
      await uploadSingleFile(upload)
    }

    setIsUploading(false)
  }

  const uploadSingleFile = async (upload: FileUpload) => {
    // Update status to uploading
    setUploads(prev => prev.map(u => 
      u.id === upload.id 
        ? { ...u, status: 'uploading' as const }
        : u
    ))

    try {
      // Resolve section ID if needed
      let actualSectionId = sectionId
      if (!actualSectionId && sectionType && onResolveSectionId) {
        actualSectionId = await onResolveSectionId(sectionType)
      }
      
      if (!actualSectionId) {
        throw new Error('No section ID available for upload')
      }
      
      const formData = new FormData()
      formData.append('file', upload.file)
      formData.append('sectionId', actualSectionId)
      if (upload.description) {
        formData.append('description', upload.description)
      }

      const response = await fetch('/api/design/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        // Update to complete
        setUploads(prev => prev.map(u => 
          u.id === upload.id 
            ? { ...u, status: 'complete' as const, progress: 100 }
            : u
        ))

        // Notify parent
        onUploadComplete(result.asset)

        // Show success toast
        toast.success(`${upload.file.name} uploaded successfully`)

        // Remove from uploads after a delay
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== upload.id))
        }, 2000)

      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      // Update to error state
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { ...u, status: 'error' as const, error: errorMessage }
          : u
      ))

      // Notify parent
      onUploadError(`Failed to upload ${upload.file.name}: ${errorMessage}`)

      // Show error toast
      toast.error(`Failed to upload ${upload.file.name}`, {
        description: errorMessage
      })
    }
  }

  // Remove upload from queue
  const removeUpload = (uploadId: string) => {
    setUploads(prev => prev.filter(u => u.id !== uploadId))
  }

  // Update description
  const updateDescription = (uploadId: string, description: string) => {
    setUploads(prev => prev.map(u => 
      u.id === uploadId 
        ? { ...u, description }
        : u
    ))
  }

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  // Get status icon
  const getStatusIcon = (upload: FileUpload) => {
    switch (upload.status) {
      case 'pending':
        return <Upload className="w-4 h-4 text-gray-500" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  // Don't render until mounted (prevents hydration mismatch)
  if (!isMounted) {
    return (
      <div className={className}>
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100">
              <Upload className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-900 font-medium">Loading upload interface...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer
          ${isDragActive && !isDragReject ? 'border-blue-400 bg-blue-50' : ''}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-400 hover:bg-gray-50'}
          ${!isDragActive && !disabled ? 'border-gray-300' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isDragActive && !isDragReject ? 'bg-blue-100' : 
            isDragReject ? 'bg-red-100' :
            'bg-gray-100'
          }`}>
            <Upload className={`w-6 h-6 ${
              isDragActive && !isDragReject ? 'text-blue-600' : 
              isDragReject ? 'text-red-600' :
              'text-gray-600'
            }`} />
          </div>

          <div>
            {isDragActive ? (
              isDragReject ? (
                <p className="text-red-600 font-medium">Some files are not supported</p>
              ) : (
                <p className="text-blue-600 font-medium">Drop files here...</p>
              )
            ) : (
              <>
                <p className="text-gray-900 font-medium">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports JPG, PNG, WebP, PDF up to 10MB
                </p>
              </>
            )}
          </div>

          {!isDragActive && !disabled && (
            <Button size="sm" variant="outline" className="pointer-events-none">
              Choose Files
            </Button>
          )}
        </div>
      </div>

      {/* Upload Queue */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              Uploading Files ({uploads.length})
            </h4>
            {isUploading && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}
          </div>

          {uploads.map(upload => (
            <div 
              key={upload.id} 
              className="bg-white border border-gray-200 rounded-lg p-3"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-1">
                  {getFileIcon(upload.file)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {upload.file.name}
                      </p>
                      {getStatusIcon(upload)}
                    </div>

                    <button
                      onClick={() => removeUpload(upload.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      disabled={upload.status === 'uploading'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>

                  {/* Progress bar */}
                  {upload.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {upload.status === 'error' && upload.error && (
                    <p className="text-xs text-red-600 mt-1">
                      {upload.error}
                    </p>
                  )}

                  {/* Description input */}
                  {(upload.status === 'pending' || upload.status === 'uploading') && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Add description (optional)..."
                        value={upload.description}
                        onChange={(e) => updateDescription(upload.id, e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={upload.status === 'uploading'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
