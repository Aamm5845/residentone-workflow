'use client'

import { useState, useEffect } from 'react'
import { Folder, FileText, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react'
import { formatFileSize } from './v3-constants'

interface DropboxEntry {
  name: string
  path: string
  type: string
  size: number | null
  modified: string | null
}

interface DropboxFilePickerProps {
  projectId: string
  onSelect: (entry: DropboxEntry) => void
}

export function DropboxFilePicker({ projectId, onSelect }: DropboxFilePickerProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<DropboxEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFolder(currentPath)
  }, [currentPath])

  async function fetchFolder(path: string) {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/project-files-v3/file-sends/browse?path=${encodeURIComponent(path)}`
      )
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (err) {
      console.error('Browse failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function navigateUp() {
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  const pathParts = currentPath ? currentPath.split('/') : []

  return (
    <div className="space-y-2">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        {currentPath && (
          <button
            onClick={navigateUp}
            className="h-6 w-6 rounded hover:bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => setCurrentPath('')}
          className="hover:text-gray-700 font-medium"
        >
          Project
        </button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <button
              onClick={() => setCurrentPath(pathParts.slice(0, i + 1).join('/'))}
              className="hover:text-gray-700"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">Empty folder</div>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.path}
              onClick={() => {
                if (entry.type === 'folder') {
                  setCurrentPath(entry.path)
                } else {
                  onSelect(entry)
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              {entry.type === 'folder' ? (
                <Folder className="h-4 w-4 text-blue-500 shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              <span className="flex-1 text-sm text-gray-700 truncate">{entry.name}</span>
              {entry.type !== 'folder' && entry.size && (
                <span className="text-[10px] text-gray-400 shrink-0">
                  {formatFileSize(entry.size)}
                </span>
              )}
              {entry.type === 'folder' && (
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
