'use client'

import React, { useState, useCallback } from 'react'
import { Upload, X, File, Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDropzone } from 'react-dropzone'

interface RoomFilesUploadProps {
  roomId: string
}

interface UploadedFile {
  id: string
  name: string
  url: string
  size: number
  type: string
}

export function RoomFilesUpload({ roomId }: RoomFilesUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true)
    
    try {
      for (const file of acceptedFiles) {
        // Upload to Vercel Blob via API
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'room-drawing')
        formData.append('roomId', roomId)
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData
        })
        
        const uploadResult = await uploadResponse.json()
        
        if (uploadResult.success) {
          const newFile: UploadedFile = {
            id: uploadResult.fileId || Date.now().toString(),
            name: file.name,
            url: uploadResult.url,
            size: file.size,
            type: file.type
          }
          
          setFiles(prev => [...prev, newFile])
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true,
    disabled: isUploading
  })

  const handleRemoveFile = async (fileId: string) => {
    // Just remove from UI for now - can add API call later if needed
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />
    if (type.includes('image')) return <ImageIcon className="w-4 h-4 text-blue-500" />
    return <File className="w-4 h-4 text-gray-500" />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Room Drawings & Files</h4>
        <span className="text-xs text-gray-500">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
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
              <p className="text-sm font-medium text-gray-700">
                {isDragActive 
                  ? 'Drop files here'
                  : 'Upload files'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, Images, Excel, Word • Drag & drop or click
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-gray-900">{file.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFile(file.id)}
                className="flex-shrink-0 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !isUploading && (
        <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/30">
          <p className="text-xs text-gray-500">No files uploaded yet</p>
        </div>
      )}
    </div>
  )
}
