'use client'

import { useState } from 'react'
import { 
  Search, 
  Cloud, 
  Database, 
  AlertCircle, 
  CheckCircle,
  Folder,
  FileImage,
  FileVideo,
  File,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Project {
  id: string
  name: string
  dropboxFolder: string | null
  client: { name: string } | null
  _count?: { assets: number }
  hasDropbox?: boolean
}

interface Asset {
  id: string
  title: string
  filename: string | null
  type: string
  size: number | null
  mimeType: string | null
  storageType: 'dropbox' | 'database' | 'empty' | 'other'
  storagePath: string | null
  createdAt: string
  uploadedBy: string
}

interface Summary {
  total: number
  dropbox: number
  database: number
  empty: number
  other: number
}

export default function AssetStorageChecker() {
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchProjects = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)
    setProjects([])
    setSelectedProject(null)
    setAssets([])
    setSummary(null)

    try {
      const res = await fetch(`/api/admin/asset-storage?search=${encodeURIComponent(searchQuery)}`)
      if (!res.ok) throw new Error('Failed to search projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadProjectAssets = async (project: Project) => {
    setLoadingAssets(true)
    setError(null)
    setSelectedProject(project)
    setAssets([])
    setSummary(null)

    try {
      const res = await fetch(`/api/admin/asset-storage?projectId=${project.id}`)
      if (!res.ok) throw new Error('Failed to load assets')
      const data = await res.json()
      setAssets(data.assets || [])
      setSummary(data.summary || null)
      setSelectedProject(data.project || project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoadingAssets(false)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStorageIcon = (type: string) => {
    switch (type) {
      case 'dropbox':
        return <Cloud className="h-4 w-4 text-blue-500" />
      case 'database':
        return <Database className="h-4 w-4 text-amber-500" />
      case 'empty':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <File className="h-4 w-4 text-gray-500" />
    }
  }

  const getStorageBadge = (type: string) => {
    switch (type) {
      case 'dropbox':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Dropbox</Badge>
      case 'database':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Database</Badge>
      case 'empty':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Empty/Failed</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Other</Badge>
    }
  }

  const getFileIcon = (type: string, mimeType: string | null) => {
    if (mimeType?.startsWith('image/') || type === 'IMAGE') {
      return <FileImage className="h-5 w-5 text-purple-500" />
    }
    if (mimeType?.startsWith('video/') || type === 'VIDEO') {
      return <FileVideo className="h-5 w-5 text-pink-500" />
    }
    return <File className="h-5 w-5 text-gray-500" />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Asset Storage Checker
          </CardTitle>
          <CardDescription>
            Search for any project to see where its assets are stored (Dropbox vs Database)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by project name, client, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchProjects()}
              className="flex-1"
            />
            <Button onClick={searchProjects} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Project Search Results */}
          {projects.length > 0 && !selectedProject && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-500">Found {projects.length} project(s):</p>
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => loadProjectAssets(project)}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.client?.name || 'No client'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {project._count?.assets || 0} assets
                    </span>
                    {project.dropboxFolder ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        <Folder className="h-3 w-3 mr-1" />
                        Dropbox
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                        No Dropbox
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Project Details */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedProject.name}</CardTitle>
                <CardDescription>
                  {selectedProject.client?.name || 'No client'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedProject(null)
                setAssets([])
                setSummary(null)
              }}>
                ← Back to Results
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropbox Status */}
            <div className={`p-4 rounded-lg border ${selectedProject.dropboxFolder ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2">
                {selectedProject.dropboxFolder ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Dropbox Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-900">Dropbox Not Connected</span>
                  </>
                )}
              </div>
              {selectedProject.dropboxFolder && (
                <p className="text-sm text-blue-700 mt-1 font-mono break-all">
                  {selectedProject.dropboxFolder}
                </p>
              )}
              {!selectedProject.dropboxFolder && (
                <p className="text-sm text-amber-700 mt-1">
                  Photos for this project are stored in the database, not Dropbox.
                  Configure Dropbox in Project Settings to upload future photos to Dropbox.
                </p>
              )}
            </div>

            {/* Summary */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-sm text-gray-500">Total Assets</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{summary.dropbox}</p>
                  <p className="text-sm text-blue-600">In Dropbox</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-600">{summary.database}</p>
                  <p className="text-sm text-amber-600">In Database</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{summary.empty}</p>
                  <p className="text-sm text-red-600">Empty/Failed</p>
                </div>
              </div>
            )}

            {/* Loading */}
            {loadingAssets && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <span className="ml-2 text-gray-500">Loading assets...</span>
              </div>
            )}

            {/* Assets List */}
            {!loadingAssets && assets.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="text-sm font-medium text-gray-700">
                    Showing {assets.length} assets (newest first)
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y">
                  {assets.map((asset) => (
                    <div key={asset.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        {getFileIcon(asset.type, asset.mimeType)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {asset.title || asset.filename || 'Untitled'}
                            </p>
                            {getStorageBadge(asset.storageType)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span>{formatFileSize(asset.size)}</span>
                            <span>•</span>
                            <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>by {asset.uploadedBy}</span>
                          </div>
                          {asset.storagePath && asset.storageType === 'dropbox' && (
                            <p className="text-xs text-blue-600 mt-1 font-mono truncate">
                              {asset.storagePath}
                            </p>
                          )}
                        </div>
                        {getStorageIcon(asset.storageType)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loadingAssets && assets.length === 0 && summary && (
              <div className="text-center py-8 text-gray-500">
                <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No assets found for this project</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

