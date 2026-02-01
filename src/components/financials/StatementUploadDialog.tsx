'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Calendar,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatementUpload {
  id: string
  fileName: string
  fileUrl: string
  statementMonth: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  pageCount: number | null
  transactionCount: number
  duplicateCount: number
  uniqueCount: number
  errorMessage: string | null
  createdAt: string
}

interface StatementUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: {
    id: string
    name: string
    institutionName: string
    mask: string | null
  }
  onUploadComplete?: () => void
}

export function StatementUploadDialog({
  open,
  onOpenChange,
  account,
  onUploadComplete,
}: StatementUploadDialogProps) {
  const [uploads, setUploads] = useState<StatementUpload[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [error, setError] = useState<string | null>(null)

  // Generate last 6 months for dropdown
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return { value, label }
  })

  const fetchUploads = useCallback(async () => {
    if (!account.id) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/statements/account/${account.id}`)
      if (res.ok) {
        const data = await res.json()
        setUploads(data.uploads || [])
      }
    } catch (err) {
      console.error('Failed to fetch uploads:', err)
    } finally {
      setIsLoading(false)
    }
  }, [account.id])

  useEffect(() => {
    if (open && account.id) {
      fetchUploads()
    }
  }, [open, account.id, fetchUploads])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      await uploadFile(files[0])
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await uploadFile(files[0])
    }
    // Reset input
    e.target.value = ''
  }

  const uploadFile = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bankAccountId', account.id)
      formData.append('statementMonth', `${selectedMonth}-01`)

      const res = await fetch('/api/statements/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()

      // Refresh the list
      await fetchUploads()

      // Automatically start processing
      if (data.upload?.id) {
        await processUpload(data.upload.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const processUpload = async (uploadId: string) => {
    setIsProcessing(uploadId)
    setError(null)

    try {
      const res = await fetch('/api/statements/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Processing failed')
      }

      // Refresh the list
      await fetchUploads()

      // Notify parent that we have new transactions
      onUploadComplete?.()
    } catch (err: any) {
      setError(err.message || 'Failed to process statement')
    } finally {
      setIsProcessing(null)
    }
  }

  const deleteUpload = async (uploadId: string) => {
    if (!confirm('Delete this statement and all its extracted transactions?')) {
      return
    }

    try {
      const res = await fetch(`/api/statements/account/${account.id}?uploadId=${uploadId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }

      await fetchUploads()
      onUploadComplete?.()
    } catch (err: any) {
      setError(err.message || 'Failed to delete statement')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  const StatusBadge = ({ status }: { status: StatementUpload['status'] }) => {
    const config = {
      PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Pending' },
      PROCESSING: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing' },
      COMPLETED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Complete' },
      FAILED: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
    }

    const { icon: Icon, color, bg, label } = config[status]

    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', bg, color)}>
        <Icon className={cn('h-3 w-3', status === 'PROCESSING' && 'animate-spin')} />
        {label}
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Upload Statement
          </DialogTitle>
          <DialogDescription>
            Upload PDF statements for {account.institutionName} ****{account.mask} to extract transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Month Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Statement Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400',
              isUploading && 'opacity-50 pointer-events-none'
            )}
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                <p className="mt-2 text-gray-600">Uploading...</p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-gray-400" />
                <p className="mt-2 text-gray-600">
                  Drag and drop your PDF statement here, or{' '}
                  <label className="text-purple-600 hover:text-purple-700 cursor-pointer underline">
                    browse
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="mt-1 text-sm text-gray-400">PDF files only</p>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Existing Uploads */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Uploaded Statements</h3>
              <button
                onClick={fetchUploads}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                Refresh
              </button>
            </div>

            {isLoading && uploads.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p>No statements uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="bg-gray-50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{formatDate(upload.statementMonth)}</p>
                        <p className="text-xs text-gray-500 truncate">{upload.fileName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={upload.status} />

                      {upload.status === 'COMPLETED' && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{upload.uniqueCount} new</p>
                          {upload.duplicateCount > 0 && (
                            <p className="text-xs text-gray-400">{upload.duplicateCount} duplicates</p>
                          )}
                        </div>
                      )}

                      {upload.status === 'PENDING' && (
                        <Button
                          size="sm"
                          onClick={() => processUpload(upload.id)}
                          disabled={isProcessing === upload.id}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {isProcessing === upload.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Process'
                          )}
                        </Button>
                      )}

                      {upload.status === 'FAILED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processUpload(upload.id)}
                          disabled={isProcessing === upload.id}
                        >
                          {isProcessing === upload.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Retry'
                          )}
                        </Button>
                      )}

                      <button
                        onClick={() => deleteUpload(upload.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium">How it works:</p>
            <ul className="mt-1 space-y-1 text-blue-600">
              <li>1. Upload your PDF credit card statement</li>
              <li>2. AI extracts all transactions with amounts and dates</li>
              <li>3. Duplicates with existing bank data are automatically detected</li>
              <li>4. Unique transactions are included in your variable expense analysis</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
