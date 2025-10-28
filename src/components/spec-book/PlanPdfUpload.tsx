'use client'

import React, { useState, useCallback } from 'react'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDropzone } from 'react-dropzone'

interface PlanPdfUploadProps {
  projectId: string
  sectionType: string
  sectionName: string
}

interface UploadedPdf {
  id: string
  url: string
  filename: string
  size: number
  pageCount?: number
}

export function PlanPdfUpload({ projectId, sectionType, sectionName }: PlanPdfUploadProps) {
  const [pdfs, setPdfs] = useState<UploadedPdf[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Load existing PDFs on mount
  React.useEffect(() => {
    loadExistingPdfs()
  }, [projectId, sectionType])

  const loadExistingPdfs = async () => {
    try {
      const response = await fetch(
        `/api/spec-books/linked-files?projectId=${projectId}&sectionType=${sectionType}`
      )
      const result = await response.json()
      
      if (result.success && result.files) {
        setPdfs(result.files.map((f: any) => ({
          id: f.id,
          url: f.cadToPdfCacheUrl || f.dropboxPath,
          filename: f.fileName,
          size: 0,
          pageCount: f.pageCount
        })))
      }
    } catch (error) {
      console.error('Error loading existing PDFs:', error)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true)
    
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', projectId)
        formData.append('sectionType', sectionType)
        
        const uploadResponse = await fetch('/api/spec-books/upload-pdf', {
          method: 'POST',
          body: formData
        })
        
        const uploadResult = await uploadResponse.json()
        
        if (uploadResult.success) {
          const newPdf: UploadedPdf = {
            id: uploadResult.fileId,
            url: uploadResult.pdfUrl,
            filename: file.name,
            size: file.size,
            pageCount: uploadResult.pageCount
          }
          
          setPdfs(prev => [...prev, newPdf])
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
  }, [projectId, sectionType])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    disabled: isUploading
  })

  const handleRemovePdf = async (fileId: string) => {
    try {
      const response = await fetch(`/api/spec-books/upload-pdf/${fileId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setPdfs(prev => prev.filter(p => p.id !== fileId))
      } else {
        throw new Error('Failed to delete PDF')
      }
    } catch (error) {
      console.error('Error removing PDF:', error)
      alert('Failed to remove PDF')
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
      <h4 className="font-medium text-sm">PDF Plans</h4>
      
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
            <p className="text-sm text-gray-600">Uploading and processing...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <FileText className="w-8 h-8 mx-auto text-gray-400" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive 
                  ? 'Drop PDF files here'
                  : 'Upload PDF plans'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Drag & drop or click to select • PDF files only
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded PDFs */}
      {pdfs.length > 0 && (
        <div className="space-y-2">
          {pdfs.map((pdf) => (
            <div key={pdf.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{pdf.filename}</div>
                  <div className="text-xs text-gray-500">
                    {pdf.pageCount ? `${pdf.pageCount} pages` : formatFileSize(pdf.size)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePdf(pdf.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {pdfs.length === 0 && !isUploading && (
        <div className="text-sm text-gray-500 text-center py-4 border border-dashed rounded">
          No PDF plans uploaded yet
        </div>
      )}
    </div>
  )
}
