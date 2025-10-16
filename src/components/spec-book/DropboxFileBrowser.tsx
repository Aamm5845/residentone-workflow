'use client'

import { useState, useEffect } from 'react'
import { Folder, File, Plus, X, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface DropboxFile {
  id: string
  name: string
  path: string
  size: number
  lastModified: Date
  revision: string
  isFolder: boolean
}

interface DropboxFolder {
  files: DropboxFile[]
  folders: DropboxFile[]
  hasMore: boolean
  cursor?: string
}

interface DropboxFileBrowserProps {
  roomId: string | null
  projectId: string
  sectionType?: string
  sectionName?: string
}

export function DropboxFileBrowser({ roomId, projectId, sectionType, sectionName }: DropboxFileBrowserProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState('')
  const [currentFolder, setCurrentFolder] = useState<DropboxFolder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<DropboxFile[]>([])
  const [linkedFiles, setLinkedFiles] = useState<DropboxFile[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Load existing linked files on mount
  useEffect(() => {
    fetchLinkedFiles()
  }, [roomId, projectId, sectionType])

  const fetchLinkedFiles = async () => {
    try {
      const params = new URLSearchParams({
        projectId,
        ...(roomId && { roomId }),
        ...(sectionType && { sectionType }),
        ...(!roomId && !sectionType && { sectionType: 'ROOM' })
      })
      
      const response = await fetch(`/api/spec-books/linked-files?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setLinkedFiles(result.linkedFiles)
      }
    } catch (error) {
      console.error('Error fetching linked files:', error)
    }
  }

  const fetchFolderContents = async (path: string = '', cursor?: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (path) params.set('path', path)
      if (cursor) params.set('cursor', cursor)

      const response = await fetch(`/api/dropbox/browse?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setCurrentFolder(data)
        setCurrentPath(path)
      }
    } catch (error) {
      console.error('Error fetching folder contents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const searchFiles = async (query: string) => {
    if (!query.trim()) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/dropbox/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, maxResults: 50 })
      })
      const data = await response.json()
      
      if (data.success) {
        setCurrentFolder({
          files: data.files,
          folders: [],
          hasMore: false
        })
        setCurrentPath('Search Results')
      }
    } catch (error) {
      console.error('Error searching files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFolderClick = (folder: DropboxFile) => {
    fetchFolderContents(folder.path)
  }

  const handleFileSelect = (file: DropboxFile) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.id === file.id)
      if (isSelected) {
        return prev.filter(f => f.id !== file.id)
      } else {
        return [...prev, file]
      }
    })
  }

  const handleLinkFiles = async () => {
    try {
      const response = await fetch('/api/spec-books/link-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          roomId,
          sectionType: sectionType || (roomId ? 'ROOM' : undefined),
          dropboxFiles: selectedFiles.map(file => ({
            path: file.path,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified
          }))
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setLinkedFiles(prev => [...prev, ...selectedFiles])
        setSelectedFiles([])
        setIsOpen(false)
        
        // Show success message
        alert(`Successfully linked ${result.linkedFiles.length} file(s)!`)
      } else {
        alert(`Error linking files: ${result.error}`)
      }
      
    } catch (error) {
      console.error('Error linking files:', error)
      alert('Error linking files. Please try again.')
    }
  }

  const handleUnlinkFile = async (file: DropboxFile) => {
    try {
      const response = await fetch('/api/spec-books/unlink-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          filePath: file.path
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setLinkedFiles(prev => prev.filter(f => f.id !== file.id))
      } else {
        alert(`Error unlinking file: ${result.error}`)
      }
      
    } catch (error) {
      console.error('Error unlinking file:', error)
      alert('Error unlinking file. Please try again.')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatPath = (path: string) => {
    return path.split('/').filter(Boolean).join(' > ') || 'Root'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">
          {sectionName ? `${sectionName} - CAD Files` : 'CAD Files'}
        </h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchFolderContents()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Link Files
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Link CAD Files from Dropbox</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Search */}
              <div className="flex space-x-2">
                <Input
                  placeholder="Search for CAD files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchFiles(searchQuery)}
                />
                <Button onClick={() => searchFiles(searchQuery)} disabled={isLoading}>
                  Search
                </Button>
              </div>

              {/* Breadcrumb */}
              {currentPath && (
                <div className="text-sm text-gray-600">
                  📁 {formatPath(currentPath)}
                </div>
              )}

              {/* File Browser */}
              <ScrollArea className="h-96 border rounded">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : currentFolder ? (
                  <div className="p-4 space-y-2">
                    {/* Back button */}
                    {currentPath && currentPath !== 'Search Results' && (
                      <div 
                        className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => {
                          const parentPath = currentPath.split('/').slice(0, -1).join('/')
                          fetchFolderContents(parentPath)
                        }}
                      >
                        <Folder className="w-4 h-4 text-blue-500" />
                        <span>..</span>
                      </div>
                    )}

                    {/* Folders */}
                    {currentFolder.folders.map((folder) => (
                      <div 
                        key={folder.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => handleFolderClick(folder)}
                      >
                        <Folder className="w-4 h-4 text-blue-500" />
                        <span className="flex-1">{folder.name}</span>
                      </div>
                    ))}

                    {/* Files */}
                    {currentFolder.files.map((file) => {
                      const isSelected = selectedFiles.some(f => f.id === file.id)
                      return (
                        <div 
                          key={file.id}
                          className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${
                            isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleFileSelect(file)}
                        >
                          <File className="w-4 h-4 text-gray-500" />
                          <div className="flex-1">
                            <div className="font-medium">{file.name}</div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • {new Date(file.lastModified).toLocaleDateString()}
                            </div>
                          </div>
                          {isSelected && (
                            <Badge variant="secondary">Selected</Badge>
                          )}
                        </div>
                      )
                    })}

                    {currentFolder.files.length === 0 && currentFolder.folders.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        No CAD files found in this folder
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <Button onClick={() => fetchFolderContents()}>
                      Browse Dropbox
                    </Button>
                  </div>
                )}
              </ScrollArea>

              {/* Selected Files Summary */}
              {selectedFiles.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Selected Files ({selectedFiles.length})</span>
                    <Button onClick={handleLinkFiles}>
                      Link Selected Files
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file) => (
                      <div key={file.id} className="text-sm text-gray-600">
                        📄 {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Linked Files Display */}
      {linkedFiles.length > 0 && (
        <div className="space-y-2">
          {linkedFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center space-x-2">
                <File className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • Linked
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleUnlinkFile(file)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {linkedFiles.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4 border border-dashed rounded">
          No CAD files linked yet
        </div>
      )}
    </div>
  )
}