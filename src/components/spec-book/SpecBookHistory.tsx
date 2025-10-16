'use client'

import { useState, useEffect } from 'react'
import { Download, Calendar, FileText, User, Clock, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
  }
  generatedAt: string
  completedAt?: string
  downloadCount: number
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

  useEffect(() => {
    fetchHistory()
  }, [projectId])

  const fetchHistory = async () => {
    try {
      // TODO: Implement API call to fetch spec book generation history
      // const response = await fetch(`/api/projects/${projectId}/spec-books/history`)
      // const data = await response.json()
      // setGenerations(data.generations)
      
      // Mock data for now
      setGenerations([
        {
          id: '1',
          version: '1.2',
          status: 'COMPLETED',
          pdfUrl: 'https://example.com/spec-book-1.2.pdf',
          fileSize: 15234567,
          pageCount: 42,
          sectionsIncluded: ['FLOORPLANS', 'LIGHTING', 'ELECTRICAL'],
          roomsIncluded: ['room-1', 'room-2', 'room-3'],
          coverPageData: {
            clientName: 'John Smith',
            projectName: 'Modern Family Home',
            address: '123 Main Street'
          },
          generatedAt: '2025-01-15T10:30:00Z',
          completedAt: '2025-01-15T10:35:00Z',
          downloadCount: 3,
          generatedBy: {
            name: 'Sarah Designer',
            email: 'sarah@company.com'
          }
        },
        {
          id: '2',
          version: '1.1',
          status: 'COMPLETED',
          pdfUrl: 'https://example.com/spec-book-1.1.pdf',
          fileSize: 12845231,
          pageCount: 38,
          sectionsIncluded: ['FLOORPLANS', 'LIGHTING'],
          roomsIncluded: ['room-1', 'room-2'],
          coverPageData: {
            clientName: 'John Smith',
            projectName: 'Modern Family Home',
            address: '123 Main Street'
          },
          generatedAt: '2025-01-10T14:20:00Z',
          completedAt: '2025-01-10T14:23:00Z',
          downloadCount: 8,
          generatedBy: {
            name: 'Sarah Designer',
            email: 'sarah@company.com'
          }
        },
        {
          id: '3',
          version: '1.0',
          status: 'COMPLETED',
          pdfUrl: 'https://example.com/spec-book-1.0.pdf',
          fileSize: 8934123,
          pageCount: 24,
          sectionsIncluded: ['FLOORPLANS'],
          roomsIncluded: ['room-1'],
          coverPageData: {
            clientName: 'John Smith',
            projectName: 'Modern Family Home',
            address: '123 Main Street'
          },
          generatedAt: '2025-01-05T09:15:00Z',
          completedAt: '2025-01-05T09:18:00Z',
          downloadCount: 12,
          generatedBy: {
            name: 'Sarah Designer',
            email: 'sarah@company.com'
          }
        }
      ])
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
                    <Button
                      onClick={() => handleDownload(generation)}
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
                      {generation.sectionsIncluded.join(', ')}
                    </div>
                  </div>
                </div>

                {/* Cover Page Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Cover Page</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{generation.coverPageData.clientName}</div>
                    <div>{generation.coverPageData.projectName}</div>
                    <div className="text-gray-500">{generation.coverPageData.address}</div>
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