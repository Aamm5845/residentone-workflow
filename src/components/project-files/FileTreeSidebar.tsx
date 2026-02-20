'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FileText,
  PenTool,
  Box,
  Image as ImageIcon,
  Camera,
  FileCheck,
  BookOpen,
  ShoppingCart,
  HardDrive,
  PanelLeftClose,
  Loader2,
  File,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DropboxItem {
  id: string
  name: string
  path: string
  size: number
  isFolder: boolean
}

interface FileTreeSidebarProps {
  projectId: string
  dropboxFolder: string | null
  onCollapse: () => void
  onFileClick?: (file: { name: string; path: string; size: number }) => void
  registeredPaths?: Set<string>
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FOLDER_ICONS: Record<string, { icon: any; color: string }> = {
  '1- cad':        { icon: PenTool,   color: 'text-blue-500' },
  '2- 3d models':  { icon: Box,       color: 'text-emerald-500' },
  '3- renderings': { icon: ImageIcon,  color: 'text-purple-500' },
  '4- drawings':   { icon: FileText,  color: 'text-red-500' },
  '5- photos':     { icon: Camera,    color: 'text-teal-500' },
  '6- documents':  { icon: FileCheck, color: 'text-amber-500' },
  '7- reference':  { icon: BookOpen,  color: 'text-gray-500' },
  '8- shopping':   { icon: ShoppingCart, color: 'text-orange-500' },
  '9- software':   { icon: HardDrive, color: 'text-indigo-500' },
}

function getFolderIcon(name: string) {
  const lower = name.toLowerCase()
  for (const [key, config] of Object.entries(FOLDER_ICONS)) {
    if (lower.startsWith(key)) return config
  }
  return { icon: FolderOpen, color: 'text-gray-400' }
}

function cleanName(name: string): string {
  return name.replace(/^\d+-\s*/, '')
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// ─── Component ──────────────────────────────────────────────────────────────

export default function FileTreeSidebar({
  projectId,
  dropboxFolder,
  onCollapse,
  onFileClick,
  registeredPaths,
}: FileTreeSidebarProps) {
  return (
    <aside className="w-60 border-r border-gray-100 bg-gray-50/30 overflow-y-auto shrink-0">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Dropbox
          </span>
          <button
            onClick={onCollapse}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Hide file tree"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tree */}
        {dropboxFolder ? (
          <FolderNode
            projectId={projectId}
            path=""
            name="Project Root"
            level={0}
            defaultOpen
            onFileClick={onFileClick}
            registeredPaths={registeredPaths}
          />
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">
            No Dropbox folder linked
          </p>
        )}
      </div>
    </aside>
  )
}

// ─── FolderNode ─────────────────────────────────────────────────────────────

function FolderNode({
  projectId,
  path,
  name,
  level,
  defaultOpen = false,
  onFileClick,
  registeredPaths,
}: {
  projectId: string
  path: string
  name: string
  level: number
  defaultOpen?: boolean
  onFileClick?: (file: { name: string; path: string; size: number }) => void
  registeredPaths?: Set<string>
}) {
  const [open, setOpen] = useState(defaultOpen)

  const { data, isLoading } = useSWR(
    open ? `/api/projects/${projectId}/project-files-v2/browse?path=${encodeURIComponent(path)}` : null,
    fetcher
  )

  const folders: DropboxItem[] = data?.folders ?? []
  const files: DropboxItem[] = data?.files ?? []
  const folderCfg = getFolderIcon(name)
  const FolderIcon = level === 0 ? FolderOpen : folderCfg.icon

  return (
    <div>
      {/* Folder row */}
      {level > 0 && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md
            text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          style={{ paddingLeft: `${level * 12 + 6}px` }}
        >
          {open ? (
            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
          )}
          <FolderIcon className={cn('w-3.5 h-3.5 shrink-0', folderCfg.color)} />
          <span className="truncate">{cleanName(name)}</span>
        </button>
      )}

      {/* Children */}
      {(level === 0 || open) && (
        <div>
          {isLoading && (
            <div className="flex items-center gap-2 py-2" style={{ paddingLeft: `${(level + 1) * 12 + 6}px` }}>
              <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
              <span className="text-[11px] text-gray-400">Loading...</span>
            </div>
          )}

          {/* Sub-folders */}
          {folders.map((folder) => (
            <FolderNode
              key={folder.id}
              projectId={projectId}
              path={folder.path}
              name={folder.name}
              level={level + 1}
              onFileClick={onFileClick}
              registeredPaths={registeredPaths}
            />
          ))}

          {/* Files */}
          {files.map((file) => {
            const isRegistered = registeredPaths?.has(file.path.toLowerCase())
            return (
              <button
                key={file.id}
                onClick={() => onFileClick?.({ name: file.name, path: file.path, size: file.size })}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md
                  text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                style={{ paddingLeft: `${(level + 1) * 12 + 18}px` }}
              >
                <File className="w-3 h-3 shrink-0 text-gray-400" />
                <span className="truncate flex-1 text-left">{file.name}</span>
                {isRegistered && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
