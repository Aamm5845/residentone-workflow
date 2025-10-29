'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Folder, File, Download, Loader2 } from 'lucide-react'

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

export default function TestDropboxPage() {
  const [currentPath, setCurrentPath] = useState('')
  const [currentFolder, setCurrentFolder] = useState<DropboxFolder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)

  const fetchFolderContents = async (path: string = '') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (path) params.set('path', path)

      const response = await fetch(`/api/dropbox/browse?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setCurrentFolder(data)
        setCurrentPath(path)
      } else {
        alert(`Error browsing Dropbox: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error fetching folder contents:', error)
      alert(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFolderClick = (folder: DropboxFile) => {
    fetchFolderContents(folder.path)
  }

  const handleDownloadFile = async (file: DropboxFile) => {
    setDownloadingFile(file.id)
    try {
      const response = await fetch('/api/test-dropbox/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: file.id,
          filePath: file.path,
          fileName: file.name
        })
      })

      const result = await response.json()

      if (result.success) {
        // Create download link
        const link = document.createElement('a')
        link.href = `data:application/octet-stream;base64,${result.fileData}`
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        alert(`✅ Downloaded ${file.name} (${result.fileSize} bytes)`)
      } else {
        alert(`❌ Download failed: ${result.error}`)
        console.error('Download error:', result)
      }
    } catch (error) {
      console.error('Download error:', error)
      alert(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDownloadingFile(null)
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

  useEffect(() => {
    fetchFolderContents()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Dropbox Downloads</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Current Path */}
          {currentPath && (
            <div className="mb-4 p-2 bg-gray-50 rounded text-sm">
              📁 {formatPath(currentPath)}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading...
            </div>
          )}

          {/* File Browser */}
          {!isLoading && currentFolder && (
            <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-4">
              {/* Back button */}
              {currentPath && (
                <div 
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer border-b"
                  onClick={() => {
                    const parentPath = currentPath.split('/').slice(0, -1).join('/')
                    fetchFolderContents(parentPath)
                  }}
                >
                  <Folder className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">← Back</span>
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
                  <span className="flex-1 font-medium">{folder.name}</span>
                </div>
              ))}

              {/* Files */}
              {currentFolder.files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded border"
                >
                  <File className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {new Date(file.lastModified).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadFile(file)}
                    disabled={downloadingFile === file.id}
                  >
                    {downloadingFile === file.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!currentFolder && !isLoading && (
            <Button onClick={() => fetchFolderContents()}>
              Browse Files
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
