'use client'

import { useState, useCallback } from 'react'
import { Upload, X, File, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

interface PDFFile {
  id: string
  fileName: string
  uploadedPdfUrl: string
  fileSize?: number
}

interface PDFUploadProps {
  sectionId: string
  sectionType: string
  existingFiles?: PDFFile[]
  onUpdate?: () => void
}

export function PDFUpload({ sectionId, sectionType, existingFiles = [], onUpdate }: PDFUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<PDFFile[]>(existingFiles)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        // Upload PDF to Vercel Blob
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'spec-book-pdf')

        const uploadResponse = await fetch('/api/upload-pdf', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload PDF')
        }

        const uploadResult = await uploadResponse.json()

        // Link the uploaded PDF to the spec book section
        const linkResponse = await fetch('/api/spec-books/upload-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sectionId,
            fileName: file.name,
            uploadedPdfUrl: uploadResult.url,
            fileSize: file.size
          })
        })

        if (!linkResponse.ok) {
          throw new Error('Failed to link PDF to section')
        }

        const linkResult = await linkResponse.json()

        // Add to local state
        setFiles(prev => [...prev, {
          id: linkResult.fileLink.id,
          fileName: file.name,
          uploadedPdfUrl: uploadResult.url,
          fileSize: file.size
        }])

        toast.success(`${file.name} uploaded successfully`)
      }

      onUpdate?.()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload PDF')
    } finally {
      setUploading(false)
    }
  }, [sectionId, onUpdate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    disabled: uploading
  })

  const removeFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/spec-books/upload-pdf/${fileId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to remove PDF')
      }

      setFiles(prev => prev.filter(f => f.id !== fileId))
      toast.success('PDF removed')
      onUpdate?.()
    } catch (error) {
      console.error('Remove error:', error)
      toast.error('Failed to remove PDF')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-white'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600">Uploading PDF...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                {isDragActive 
                  ? 'Drop PDF files here'
                  : 'Upload PDF files'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Drag & drop or click to select • PDF files only
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Page numbers will be added automatically in the spec book
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploaded PDFs</h4>
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 bg-red-50 rounded flex items-center justify-center">
                  <File className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{file.fileName}</div>
                  <div className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !uploading && (
        <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          No PDF files uploaded yet
        </div>
      )}
    </div>
  )
}
