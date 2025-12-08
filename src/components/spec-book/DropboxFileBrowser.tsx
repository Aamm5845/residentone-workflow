'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
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
  onLinked?: (payload: {
    section: { id: string; name: string; type: string }
    linkedFiles: Array<{
      id: string
      fileName: string
      dropboxPath: string
      fileSize?: number
      lastModified?: Date
    }>
  }) => void
  // New props for CTB file selection
  onFileSelected?: (file: DropboxFile) => void
  allowedExtensions?: string[] // e.g., ['.ctb', '.dwg', '.dxf']
  mode?: 'link' | 'select' // 'link' for linking files, 'select' for one-time selection
  variant?: 'default' | 'settings' | 'ctb-selector'
  allowMultiple?: boolean
  maxSelections?: number
  allowFolderSelection?: boolean // Allow selecting folders instead of just files
}

export function DropboxFileBrowser({ 
  roomId, 
  projectId, 
  sectionType, 
  sectionName, 
  onLinked,
  onFileSelected,
  allowedExtensions,
  mode = 'link',
  variant = 'default', 
  allowMultiple = true,
  maxSelections,
  allowFolderSelection = false
}: DropboxFileBrowserProps) {
  
  // Fetch project data to get dropboxFolder path
  const { data: projectData } = useSWR(
    projectId ? `/api/projects/${projectId}` : null,
    (url) => fetch(url).then(r => r.json()).catch(() => null)
  )
  
  const [isOpen, setIsOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState('')
  const [currentFolder, setCurrentFolder] = useState<DropboxFolder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<DropboxFile[]>([])
  const [linkedFiles, setLinkedFiles] = useState<DropboxFile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [hasInitialized, setHasInitialized] = useState(false)

  // Load existing linked files on mount
  useEffect(() => {
    fetchLinkedFiles()
  }, [roomId, projectId, sectionType])

  // Auto-initialize with project folder when project data is loaded
  useEffect(() => {
    if (projectData && projectData.dropboxFolder && !hasInitialized) {
      console.log('[DropboxFileBrowser] Auto-initializing with project folder:', projectData.dropboxFolder)
      setCurrentPath(projectData.dropboxFolder)
      fetchFolderContents(projectData.dropboxFolder)
      setHasInitialized(true)
    } else if (projectData && !projectData.dropboxFolder && !hasInitialized) {
      // Project exists but has no dropboxFolder set, start at root
      console.log('[DropboxFileBrowser] No dropboxFolder set, starting at root')
      setHasInitialized(true)
    }
  }, [projectData, hasInitialized])

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
    console.log('[DropboxFileBrowser] fetchFolderContents called with path:', JSON.stringify(path))
    console.log('[DropboxFileBrowser] fetchFolderContents called with cursor:', cursor)
    
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (path) params.set('path', path)
      if (cursor) params.set('cursor', cursor)

      console.log('[DropboxFileBrowser] Fetching Dropbox folder:', { path, cursor, url: `/api/dropbox/browse?${params}` })
      const response = await fetch(`/api/dropbox/browse?${params}`)
      const data = await response.json()
      console.log('[DropboxFileBrowser] Dropbox browse response:', data)
      
      if (data.success) {
        setCurrentFolder(data)
        setCurrentPath(path)
      } else {
        console.error('Dropbox browse failed:', data)
        alert(`Error browsing Dropbox: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error fetching folder contents:', error)
      alert(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    console.log('[DropboxFileBrowser] Folder clicked:', folder.name)
    console.log('[DropboxFileBrowser] Folder path:', folder.path)
    console.log('[DropboxFileBrowser] Full folder object:', folder)
    fetchFolderContents(folder.path)
  }

  const handleFileSelect = (file: DropboxFile) => {
    // For select mode with single selection, handle differently
    if (mode === 'select' && !allowMultiple) {
      setSelectedFiles([file])
      // Immediately call the selection callback if provided
      if (onFileSelected) {
        onFileSelected(file)
      }
      return
    }

    // For multi-selection mode
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.id === file.id)
      if (isSelected) {
        return prev.filter(f => f.id !== file.id)
      } else {
        // Check max selections limit
        if (maxSelections && prev.length >= maxSelections) {
          alert(`You can only select up to ${maxSelections} file(s)`)
          return prev
        }
        const newSelection = [...prev, file]
        
        // For select mode with multiple selection, call callback with all selected
        if (mode === 'select' && onFileSelected && newSelection.length === 1) {
          onFileSelected(file)
        }
        
        return newSelection
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
            id: file.id, // NEW: include file ID
            path: file.path,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified
          }))
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Refresh linked files from server instead of local state
        await fetchLinkedFiles()
        setSelectedFiles([])
        setIsOpen(false)
        
        // Notify parent component if callback provided
        if (onLinked) {
          onLinked({
            section: result.section,
            linkedFiles: result.linkedFiles
          })
        }
        
        // Show improved success message with better feedback
        const linkedCount = result.linkedFiles?.length || 0
        const skippedCount = result.skippedFiles?.length || 0
        
        const msg = skippedCount
          ? `Linked ${linkedCount} file(s). Skipped ${skippedCount} file(s).`
          : `Successfully linked ${linkedCount} file(s)!`
        
        alert(msg)
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
      const response = await fetch('/api/spec-books/link-files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          dropboxPath: file.path,
          sectionType: sectionType || (roomId ? 'ROOM' : undefined),
          roomId
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchLinkedFiles() // Refresh from server
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

  // Helper function to check if file extension is allowed
  const isFileAllowed = (fileName: string): boolean => {
    if (!allowedExtensions || allowedExtensions.length === 0) {
      return true // No filtering if no extensions specified
    }
    
    const fileExt = '.' + fileName.toLowerCase().split('.').pop()
    return allowedExtensions.some(ext => ext.toLowerCase() === fileExt)
  }

  // Filter files based on allowed extensions
  const filterFiles = (files: DropboxFile[]): DropboxFile[] => {
    return files.filter(file => isFileAllowed(file.name))
  }

  // If this is the settings variant, render inline content without dialog
  if (variant === 'settings') {
    return (
      <div className="space-y-4">
        {/* Auto-fetch folder contents when component mounts */}
        {!currentFolder && !isLoading && (
          <div className="flex items-center justify-center py-4">
            <Button 
              onClick={() => {
                
                fetchFolderContents()
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
              ) : (
                <>Browse Dropbox</>
              )}
            </Button>
          </div>
        )}

        {/* Search */}
        {currentFolder && (
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
        )}

        {/* Breadcrumb */}
        {currentPath && (
          <div className="text-sm text-gray-600">
            📁 {formatPath(currentPath)}
          </div>
        )}

        {/* Select Current Folder Button - when folder selection is enabled */}
        {allowFolderSelection && currentPath && currentPath !== 'Search Results' && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Current folder: {currentPath.split('/').pop() || 'Root'}</span>
            </div>
            <Button 
              size="sm"
              onClick={() => {
                const folderData: DropboxFile = {
                  id: `folder-${currentPath}`,
                  name: currentPath.split('/').pop() || 'Root',
                  path: currentPath,
                  size: 0,
                  lastModified: new Date(),
                  revision: '',
                  isFolder: true
                }
                onFileSelected?.(folderData)
              }}
            >
              Select This Folder
            </Button>
          </div>
        )}

        {/* File Browser */}
        {currentFolder && (
          <ScrollArea className="h-96 border rounded">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
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
                {currentFolder.folders.map((folder) => {
                  console.log('[DropboxFileBrowser] Rendering folder:', folder.name, 'with path:', folder.path)
                  return (
                    <div 
                      key={folder.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer group"
                      onClick={(e) => {
                        console.log('[DropboxFileBrowser] Folder div clicked!', folder.name)
                        e.preventDefault()
                        e.stopPropagation()
                        handleFolderClick(folder)
                      }}
                    >
                      <Folder className="w-4 h-4 text-blue-500" />
                      <span className="flex-1">{folder.name}</span>
                      {/* Quick select button for folders when folder selection is enabled */}
                      {allowFolderSelection && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            onFileSelected?.(folder)
                          }}
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  )
                })}

                {/* Files */}
                {filterFiles(currentFolder.files).map((file) => {
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

                {filterFiles(currentFolder.files).length === 0 && currentFolder.folders.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    {allowedExtensions && allowedExtensions.length > 0 
                      ? `No ${allowedExtensions.join(', ')} files found in this folder`
                      : 'No CAD files found in this folder'
                    }
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        )}

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
    )
  }

  // Original dialog mode for backwards compatibility
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
              onClick={() => {
                
                fetchFolderContents()
              }}
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
                    {filterFiles(currentFolder.files).map((file) => {
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

                    {filterFiles(currentFolder.files).length === 0 && currentFolder.folders.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        {allowedExtensions && allowedExtensions.length > 0 
                          ? `No ${allowedExtensions.join(', ')} files found in this folder`
                          : 'No CAD files found in this folder'
                        }
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
                    {mode === 'link' ? (
                      <Button onClick={handleLinkFiles}>
                        Link Selected Files
                      </Button>
                    ) : (
                      <Button onClick={() => setIsOpen(false)}>
                        Use Selected
                      </Button>
                    )}
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
