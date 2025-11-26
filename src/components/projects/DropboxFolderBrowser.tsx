'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Folder, ChevronRight, Home, Loader2, Check } from 'lucide-react'

interface DropboxFile {
  id: string
  name: string
  path: string
  isFolder: boolean
}

interface DropboxFolderBrowserProps {
  onSelect: (path: string) => void
  currentPath?: string
  teamMemberId?: string
}

export function DropboxFolderBrowser({ 
  onSelect, 
  currentPath = '',
  teamMemberId 
}: DropboxFolderBrowserProps) {
  const [path, setPath] = useState(currentPath || '')
  const [folders, setFolders] = useState<DropboxFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])

  // Load folders for current path
  const loadFolders = async (folderPath: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({ path: folderPath })
      if (teamMemberId) {
        params.append('memberId', teamMemberId)
      }
      
      const response = await fetch(`/api/dropbox/browse?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load folders')
      }
      
      // Only show folders, not files
      setFolders(data.folders || [])
      
      // Update breadcrumbs
      if (folderPath === '' || folderPath === '/') {
        setBreadcrumbs([])
      } else {
        const parts = folderPath.split('/').filter(Boolean)
        setBreadcrumbs(parts)
      }
    } catch (err: any) {
      console.error('Error loading folders:', err)
      setError(err.message || 'Failed to load folders')
    } finally {
      setLoading(false)
    }
  }

  // Load folders on mount and when path changes
  useEffect(() => {
    loadFolders(path)
  }, [path])

  // Navigate to a folder
  const navigateToFolder = (folderPath: string) => {
    setPath(folderPath)
  }

  // Navigate to breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const newPath = '/' + breadcrumbs.slice(0, index + 1).join('/')
    setPath(newPath)
  }

  // Go to root
  const goToRoot = () => {
    setPath('')
  }

  // Select current folder
  const selectCurrentFolder = () => {
    onSelect(path || '/')
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-sm text-gray-600 overflow-x-auto">
        <button
          type="button"
          onClick={goToRoot}
          className="flex items-center hover:text-purple-600 transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center space-x-2">
            <ChevronRight className="w-4 h-4" />
            <button
              type="button"
              onClick={() => navigateToBreadcrumb(index)}
              className="hover:text-purple-600 transition-colors whitespace-nowrap"
            >
              {crumb}
            </button>
          </div>
        ))}
      </div>

      {/* Current Path Display */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2 text-sm">
          <Folder className="w-4 h-4 text-gray-500" />
          <span className="font-mono text-gray-700">
            {path || '/'}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={selectCurrentFolder}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Check className="w-4 h-4 mr-2" />
          Select This Folder
        </Button>
      </div>

      {/* Folder List */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-600">Loading folders...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadFolders(path)}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : folders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No folders found in this location</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => navigateToFolder(folder.path)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Folder className="w-5 h-5 text-blue-500" />
                    <span className="text-gray-700">{folder.name}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Path Input */}
      <div className="pt-4 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or enter path manually:
        </label>
        <div className="flex space-x-2">
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/Projects/MyProject"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => loadFolders(path)}
          >
            Browse
          </Button>
        </div>
      </div>
    </div>
  )
}
