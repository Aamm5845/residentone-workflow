'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Upload,
  File,
  Image,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Paperclip
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface UploadedFile {
  id: string
  title: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  dropboxPath?: string
  type: string
}

interface FileUploadProps {
  projectId: string
  category?: string
  fileType?: 'Drawings' | 'Quotes' | 'Photos'
  rfqId?: string
  supplierQuoteId?: string
  clientQuoteId?: string
  orderId?: string
  onUploadComplete?: (file: UploadedFile) => void
  onUploadError?: (error: string) => void
  maxFiles?: number
  visibleToClient?: boolean
  visibleToSupplier?: boolean
  compact?: boolean
  className?: string
}

interface PendingFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'complete' | 'error'
  progress: number
  error?: string
  uploadedFile?: UploadedFile
}

export default function FileUpload({
  projectId,
  category = 'General',
  fileType = 'Drawings',
  rfqId,
  supplierQuoteId,
  clientQuoteId,
  orderId,
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  visibleToClient = false,
  visibleToSupplier = true,
  compact = false,
  className = ''
}: FileUploadProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Check max files
    const totalFiles = uploadedFiles.length + pendingFiles.length + acceptedFiles.length
    if (totalFiles > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Add to pending
    const newPending: PendingFile[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0
    }))

    setPendingFiles(prev => [...prev, ...newPending])

    // Start uploads
    setIsUploading(true)

    for (const pending of newPending) {
      await uploadFile(pending)
    }

    setIsUploading(false)
  }, [uploadedFiles.length, pendingFiles.length, maxFiles])

  const uploadFile = async (pending: PendingFile) => {
    // Update status
    setPendingFiles(prev =>
      prev.map(p => p.id === pending.id ? { ...p, status: 'uploading' } : p)
    )

    try {
      const formData = new FormData()
      formData.append('file', pending.file)
      formData.append('projectId', projectId)
      formData.append('category', category)
      formData.append('fileType', fileType)
      formData.append('visibleToClient', String(visibleToClient))
      formData.append('visibleToSupplier', String(visibleToSupplier))

      if (rfqId) formData.append('rfqId', rfqId)
      if (supplierQuoteId) formData.append('supplierQuoteId', supplierQuoteId)
      if (clientQuoteId) formData.append('clientQuoteId', clientQuoteId)
      if (orderId) formData.append('orderId', orderId)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success && result.document) {
        // Update pending to complete
        setPendingFiles(prev =>
          prev.map(p => p.id === pending.id
            ? { ...p, status: 'complete', uploadedFile: result.document }
            : p
          )
        )

        // Add to uploaded files
        setUploadedFiles(prev => [...prev, result.document])

        // Notify parent
        onUploadComplete?.(result.document)

        // Remove from pending after delay
        setTimeout(() => {
          setPendingFiles(prev => prev.filter(p => p.id !== pending.id))
        }, 1500)

      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed'

      setPendingFiles(prev =>
        prev.map(p => p.id === pending.id
          ? { ...p, status: 'error', error: errorMsg }
          : p
        )
      )

      onUploadError?.(errorMsg)
      toast.error(`Failed to upload ${pending.file.name}`)
    }
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const removePending = (pendingId: string) => {
    setPendingFiles(prev => prev.filter(p => p.id !== pendingId))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: true
  })

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />
    if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />
    return <File className="w-4 h-4 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Compact mode - just a button with file list
  if (compact) {
    return (
      <div className={className}>
        <div {...getRootProps()} className="inline-block">
          <input {...getInputProps()} />
          <Button type="button" variant="outline" size="sm" disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4 mr-2" />
            )}
            Attach Files
          </Button>
        </div>

        {/* Compact file list */}
        {(uploadedFiles.length > 0 || pendingFiles.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {uploadedFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs"
              >
                {getFileIcon(file.mimeType)}
                <span className="max-w-[120px] truncate">{file.fileName}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {pendingFiles.map(pending => (
              <div
                key={pending.id}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  pending.status === 'error' ? 'bg-red-100' : 'bg-blue-100'
                }`}
              >
                {pending.status === 'uploading' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : pending.status === 'error' ? (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                )}
                <span className="max-w-[120px] truncate">{pending.file.name}</span>
                {pending.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => removePending(pending.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full mode - dropzone with file list
  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragActive
            ? 'border-purple-400 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isDragActive ? 'bg-purple-100' : 'bg-gray-100'
          }`}>
            <Upload className={`w-6 h-6 ${isDragActive ? 'text-purple-600' : 'text-gray-600'}`} />
          </div>

          {isDragActive ? (
            <p className="text-purple-600 font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-900 font-medium">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Images, PDF, Word, Excel up to 25MB
              </p>
            </>
          )}

          {!isDragActive && (
            <Button type="button" size="sm" variant="outline" className="pointer-events-none">
              Choose Files
            </Button>
          )}
        </div>
      </div>

      {/* Pending Uploads */}
      {pendingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploading...</h4>
          {pendingFiles.map(pending => (
            <div
              key={pending.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                pending.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            >
              {pending.status === 'uploading' ? (
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              ) : pending.status === 'complete' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : pending.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <File className="w-5 h-5 text-gray-400" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pending.file.name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(pending.file.size)}
                  {pending.error && <span className="text-red-500 ml-2">{pending.error}</span>}
                </p>
              </div>

              {pending.status !== 'uploading' && (
                <button
                  type="button"
                  onClick={() => removePending(pending.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Attached Files ({uploadedFiles.length})
          </h4>
          {uploadedFiles.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white"
            >
              {getFileIcon(file.mimeType)}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.fileName}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
              </div>

              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Export for convenience
export { FileUpload }
