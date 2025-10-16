'use client'

import { useState, useEffect } from 'react'
import { Download, Calendar, FileText, User, Clock, DollarSign, Trash2, Eye, AlertTriangle } from 'lucide-react'
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
  estimatedCost?: number
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
      // TODO: Implement API call to fetch spec book generation history
      // const response = await fetch(`/api/projects/${projectId}/spec-books/history`)
      // const data = await response.json()
      // setGenerations(data.generations)
      
      // Mock data for now
      setGenerations([
        {
          id: '1',
          version: '2.3',
          status: 'COMPLETED',
          pdfUrl: 'https://example.com/spec-book-2.3.pdf',
          fileSize: 24567890,
          pageCount: 67,
          sectionsIncluded: ['FLOORPLANS', 'LIGHTING', 'ELECTRICAL', 'PLUMBING', 'RCP'],
          roomsIncluded: ['kitchen', 'master-bedroom', 'guest-bathroom', 'living-room'],
          coverPageData: {
            clientName: 'The Williams Family',
            projectName: 'Luxury Penthouse Renovation',
            address: '1425 Park Avenue, New York, NY 10128',
            specBookType: 'Full Project',
            description: 'Complete renovation including kitchen, master suite, and living areas with high-end finishes'
          },
          generatedAt: '2025-01-16T14:22:00Z',
          completedAt: '2025-01-16T14:28:00Z',
          downloadCount: 7,
          estimatedCost: 0.064, // $0.064 for 8 CAD conversions
          cadFilesConverted: 8,
          lastDownloadedAt: '2025-01-16T16:45:00Z',
          lastDownloadedBy: {
            name: 'Michael Chen',
            email: 'mchen@meisnerinteriors.com'
          },
          generatedBy: {
            name: 'Sarah Williams',
            email: 'swilliams@meisnerinteriors.com'
          }
        },
        {
          id: '2',
          version: '2.2',
          status: 'COMPLETED',
          pdfUrl: 'https://example.com/spec-book-2.2.pdf',
          fileSize: 18234567,
          pageCount: 52,
          sectionsIncluded: ['FLOORPLANS', 'LIGHTING', 'ELECTRICAL'],
          roomsIncluded: ['kitchen', 'master-bedroom', 'living-room'],
          coverPageData: {
            clientName: 'The Williams Family',
            projectName: 'Luxury Penthouse Renovation',
            address: '1425 Park Avenue, New York, NY 10128',
            specBookType: 'Electrical & Lighting',
            description: 'Electrical and lighting specifications for renovation'
          },
          generatedAt: '2025-01-14T09:15:00Z',
          completedAt: '2025-01-14T09:21:00Z',
          downloadCount: 12,
          estimatedCost: 0.040, // $0.040 for 5 CAD conversions
          cadFilesConverted: 5,
          lastDownloadedAt: '2025-01-15T11:30:00Z',
          lastDownloadedBy: {
            name: 'David Rodriguez',
            email: 'drodriguez@contractorpartner.com'
          },
          generatedBy: {
            name: 'Sarah Williams',
            email: 'swilliams@meisnerinteriors.com'
          }
        },
        {
          id: '3',
          version: '2.1',
          status: 'COMPLETED',
          pdfUrl: 'https://example.com/spec-book-2.1.pdf',
          fileSize: 12456789,
          pageCount: 34,
          sectionsIncluded: ['FLOORPLANS', 'LIGHTING'],
          roomsIncluded: ['kitchen', 'master-bedroom'],
          coverPageData: {
            clientName: 'The Williams Family',
            projectName: 'Luxury Penthouse Renovation',
            address: '1425 Park Avenue, New York, NY 10128',
            specBookType: 'Initial Review',
            description: 'Initial floor plans and lighting design for client review'
          },
          generatedAt: '2025-01-10T16:45:00Z',
          completedAt: '2025-01-10T16:48:00Z',
          downloadCount: 18,
          estimatedCost: 0.024, // $0.024 for 3 CAD conversions
          cadFilesConverted: 3,
          lastDownloadedAt: '2025-01-12T14:20:00Z',
          lastDownloadedBy: {
            name: 'Jennifer Williams',
            email: 'jwilliams@client.com'
          },
          generatedBy: {
            name: 'Sarah Williams',
            email: 'swilliams@meisnerinteriors.com'
          }
        },
        {
          id: '4',
          version: '2.0',
          status: 'FAILED',
          sectionsIncluded: ['FLOORPLANS', 'LIGHTING', 'ELECTRICAL', 'PLUMBING'],
          roomsIncluded: ['kitchen', 'master-bedroom', 'guest-bathroom'],
          coverPageData: {
            clientName: 'The Williams Family',
            projectName: 'Luxury Penthouse Renovation',
            address: '1425 Park Avenue, New York, NY 10128',
            specBookType: 'Full Project',
            description: 'Failed generation due to CloudConvert API timeout'
          },
          generatedAt: '2025-01-09T11:30:00Z',
          downloadCount: 0,
          errorMessage: 'CAD conversion timeout: electrical-plan-level-2.dwg could not be processed within 5 minute limit',
          estimatedCost: 0.032, // Partial cost for failed conversion
          cadFilesConverted: 0,
          generatedBy: {
            name: 'Sarah Williams',
            email: 'swilliams@meisnerinteriors.com'
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
                    {generation.estimatedCost && (
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span>${generation.estimatedCost.toFixed(3)} conversion cost</span>
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