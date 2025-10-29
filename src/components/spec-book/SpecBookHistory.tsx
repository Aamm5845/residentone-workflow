'use client'

import { useState, useEffect } from 'react'
import { Download, Calendar, FileText, User, Clock, Trash2, Eye, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SpecBookGeneration {
  id: string
  version: string
  status: 'GENERATING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  pdfUrl?: string
  fileSize?: number
  pageCount?: number
  sectionsIncluded: string[]
  roomsIncluded: string[]
  coverPageData: {
    clientName: string
    projectName: string
    address: string
    specBookType?: string
    description?: string
  }
  generatedAt: string
  completedAt?: string
  downloadCount: number
  cadFilesConverted?: number
  errorMessage?: string
  lastDownloadedAt?: string
  lastDownloadedBy?: {
    name?: string
    email: string
  }
  generatedBy: {
    name?: string
    email: string
  }
}

interface SpecBookHistoryProps {
  projectId: string
}

export function SpecBookHistory({ projectId }: SpecBookHistoryProps) {
  const [generations, setGenerations] = useState<SpecBookGeneration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [projectId])

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/spec-books/${projectId}/history`)
      if (response.ok) {
        const data = await response.json()
        setGenerations(data.generations || [])
      } else {
        console.warn('Failed to fetch spec book history')
        setGenerations([])
      }
    } catch (error) {
      console.error('Error fetching spec book history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: SpecBookGeneration['status']) => {
    const variants = {
      GENERATING: 'secondary',
      COMPLETED: 'default',
      FAILED: 'destructive',
      CANCELLED: 'secondary'
    } as const

    const labels = {
      GENERATING: 'Generating',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
      CANCELLED: 'Cancelled'
    }

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    )
  }

  const calculateGenerationTime = (generatedAt: string, completedAt?: string) => {
    if (!completedAt) return 'N/A'
    const start = new Date(generatedAt)
    const end = new Date(completedAt)
    const diffMs = end.getTime() - start.getTime()
    const diffSeconds = Math.round(diffMs / 1000)
    return `${diffSeconds}s`
  }

  const handleDownload = (generation: SpecBookGeneration) => {
    if (generation.pdfUrl) {
      window.open(generation.pdfUrl, '_blank')
      // TODO: Increment download count in backend
    }
  }

  const handleDelete = async (generationId: string) => {
    if (!confirm('Are you sure you want to delete this spec book version? This action cannot be undone.')) {
      return
    }

    setDeletingId(generationId)
    try {
      // TODO: Implement API call to delete generation
      // const response = await fetch(`/api/spec-books/generations/${generationId}`, {
      //   method: 'DELETE'
      // })
      // if (response.ok) {
        setGenerations(prev => prev.filter(g => g.id !== generationId))
      // }
    } catch (error) {
      console.error('Error deleting generation:', error)
      alert('Failed to delete spec book version. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading history...</div>
        </CardContent>
      </Card>
    )
  }

  if (generations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mb-4" />
          <div className="text-lg font-medium text-gray-900 mb-2">No Spec Books Generated</div>
          <div className="text-gray-500 text-center max-w-md">
            Once you generate your first spec book, it will appear here with download links and generation history.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Generation History</h2>
        <div className="text-sm text-gray-500">
          {generations.length} generation{generations.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4">
        {generations.map((generation) => (
          <Card key={generation.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CardTitle className="text-lg">Version {generation.version}</CardTitle>
                  {getStatusBadge(generation.status)}
                </div>
                <div className="flex items-center space-x-2">
                  {generation.status === 'COMPLETED' && generation.pdfUrl && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => window.open(generation.pdfUrl, '_blank')}
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        onClick={() => handleDownload(generation)}
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(generation.id)}
                    disabled={deletingId === generation.id}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deletingId === generation.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {generation.status === 'FAILED' && generation.errorMessage && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Generation Failed:</strong> {generation.errorMessage}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Generation Details */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Generation Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{formatDate(generation.generatedAt)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{generation.generatedBy.name || generation.generatedBy.email}</span>
                    </div>
                    {generation.completedAt && (
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{calculateGenerationTime(generation.generatedAt, generation.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* File Details */}
                {generation.status === 'COMPLETED' && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">File Details</h4>
                    <div className="space-y-2 text-sm">
                      {generation.fileSize && (
                        <div>Size: {formatFileSize(generation.fileSize)}</div>
                      )}
                      {generation.pageCount && (
                        <div>Pages: {generation.pageCount}</div>
                      )}
                      <div>Downloads: {generation.downloadCount}</div>
                      {generation.cadFilesConverted && (
                        <div>CAD Files: {generation.cadFilesConverted} converted</div>
                      )}
                      {generation.lastDownloadedAt && (
                        <div className="text-xs text-gray-500 mt-2">
                          Last: {formatDate(generation.lastDownloadedAt)}
                          {generation.lastDownloadedBy && (
                            <div>by {generation.lastDownloadedBy.name || generation.lastDownloadedBy.email}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Content Summary */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Included Content</h4>
                  <div className="space-y-2 text-sm">
                    <div>Sections: {generation.sectionsIncluded.length}</div>
                    <div>Rooms: {generation.roomsIncluded.length}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      <div><strong>Sections:</strong> {generation.sectionsIncluded.join(', ') || 'None'}</div>
                      <div className="mt-1"><strong>Rooms:</strong> {generation.roomsIncluded.join(', ') || 'None'}</div>
                    </div>
                  </div>
                </div>

                {/* Cover Page Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Project Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{generation.coverPageData.clientName}</div>
                    <div>{generation.coverPageData.projectName}</div>
                    {generation.coverPageData.specBookType && (
                      <div className="text-blue-600 font-medium">{generation.coverPageData.specBookType}</div>
                    )}
                    <div className="text-gray-500 text-xs mt-2">{generation.coverPageData.address}</div>
                    {generation.coverPageData.description && (
                      <div className="text-xs text-gray-500 mt-2 italic">
                        {generation.coverPageData.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
