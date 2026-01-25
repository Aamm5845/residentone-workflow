'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Archive, Loader2 } from 'lucide-react'

interface ProjectSpecsViewProps {
  project: {
    id: string
    name: string
  }
}

interface SpecItem {
  id: string
  name: string
  specStatus: string
  roomName?: string
  sectionName?: string
  category?: string
  updatedAt?: string
}

export default function ProjectSpecsView({ project }: ProjectSpecsViewProps) {
  const [items, setItems] = useState<SpecItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSpecItems()
  }, [project.id])

  const fetchSpecItems = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/projects/${project.id}/specs/all`)
      if (!response.ok) {
        throw new Error('Failed to fetch spec items')
      }
      
      const data = await response.json()
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching spec items:', err)
      setError(err instanceof Error ? err.message : 'Failed to load spec items')
    } finally {
      setLoading(false)
    }
  }

  // Filter items based on archived status
  const filteredItems = items.filter(item => {
    if (showArchived) {
      return true // Show all items including archived
    }
    return item.specStatus !== 'ARCHIVED' // Hide archived items
  })

  const archivedCount = items.filter(item => item.specStatus === 'ARCHIVED').length
  const activeCount = items.filter(item => item.specStatus !== 'ARCHIVED').length

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'SPECIFIED':
        return 'default'
      case 'NEEDS_SPEC':
        return 'secondary' 
      case 'DRAFT':
        return 'outline'
      case 'ARCHIVED':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SPECIFIED':
        return 'Specified'
      case 'NEEDS_SPEC':
        return 'Needs Spec'
      case 'DRAFT':
        return 'Draft'
      case 'ARCHIVED':
        return 'Archived'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading spec items...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading spec items</p>
              <p className="text-sm mt-1">{error}</p>
              <Button onClick={fetchSpecItems} className="mt-4" size="sm">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          All Specs - {project.name}
        </h1>
        <p className="text-gray-600 mt-1">
          View and manage all specification items across the project
        </p>
      </div>

      {/* Stats and Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-600">
            Showing <span className="font-medium">{filteredItems.length}</span> of{' '}
            <span className="font-medium">{items.length}</span> items
          </div>
          
          {archivedCount > 0 && (
            <div className="text-sm text-gray-500">
              <Archive className="inline h-4 w-4 mr-1" />
              {archivedCount} archived
            </div>
          )}
        </div>

        {/* Show Archived Toggle */}
        {archivedCount > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="show-archived" className="text-sm font-medium">
              Show archived items
            </Label>
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            {showArchived ? (
              <Eye className="h-4 w-4 text-gray-500" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-500" />
            )}
          </div>
        )}
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <p className="font-medium">
                {items.length === 0 
                  ? 'No spec items found' 
                  : showArchived 
                    ? 'No items match the current filters'
                    : 'No active spec items found'
                }
              </p>
              <p className="text-sm mt-1">
                {items.length === 0 
                  ? 'Spec items will appear here as rooms are configured with FFE requirements'
                  : !showArchived && archivedCount > 0
                    ? `${archivedCount} archived items are hidden. Toggle "Show archived items" to see them.`
                    : 'Try adjusting your filters'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className={item.specStatus === 'ARCHIVED' ? 'opacity-75' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      {item.roomName && (
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {item.roomName}
                        </span>
                      )}
                      {item.sectionName && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                          {item.sectionName}
                        </span>
                      )}
                      {item.category && (
                        <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(item.specStatus)}>
                      {item.specStatus === 'ARCHIVED' && <Archive className="h-3 w-3 mr-1" />}
                      {getStatusLabel(item.specStatus)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              {item.updatedAt && (
                <CardContent className="pt-0">
                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(item.updatedAt).toLocaleDateString()}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}