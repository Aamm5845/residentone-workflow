'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, X, FolderOpen, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Shared Configs ──────────────────────────────────────────────────────────

const DISCIPLINE_CONFIG: Record<
  string,
  { label: string; shortLabel: string; color: string; bgColor: string; textColor: string }
> = {
  ARCHITECTURAL: { label: 'Architectural', shortLabel: 'ARCH', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  ELECTRICAL: { label: 'Electrical', shortLabel: 'ELEC', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  RCP: { label: 'RCP', shortLabel: 'RCP', color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  PLUMBING: { label: 'Plumbing', shortLabel: 'PLMB', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  MECHANICAL: { label: 'Mechanical', shortLabel: 'MECH', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  INTERIOR_DESIGN: { label: 'Interior Design', shortLabel: 'INT', color: 'bg-pink-500', bgColor: 'bg-pink-50', textColor: 'text-pink-700' },
}

const DRAWING_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  REFLECTED_CEILING: 'Reflected Ceiling',
  ELEVATION: 'Elevation',
  DETAIL: 'Detail',
  SECTION: 'Section',
  TITLE_BLOCK: 'Title Block',
  XREF: 'XREF',
  SCHEDULE: 'Schedule',
  OTHER: 'Other',
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditDrawing {
  id: string
  drawingNumber: string
  title: string
  discipline: string
  drawingType: string
  floorId: string | null
  description: string | null
  dropboxPath: string | null
  dropboxUrl: string | null
  fileName: string | null
  fileSize: number | null
  scale: string | null
  paperSize: string | null
}

interface Floor {
  id: string
  name: string
  shortName: string
}

interface DrawingFormDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editDrawing?: EditDrawing | null
  floors: Floor[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrawingFormDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  editDrawing,
  floors: initialFloors,
}: DrawingFormDialogProps) {
  const isEditing = !!editDrawing

  // Form state
  const [drawingNumber, setDrawingNumber] = useState('')
  const [title, setTitle] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [drawingType, setDrawingType] = useState('')
  const [floorId, setFloorId] = useState<string>('')
  const [scale, setScale] = useState('')
  const [paperSize, setPaperSize] = useState('')
  const [dropboxPath, setDropboxPath] = useState('')
  const [fileName, setFileName] = useState('')
  const [description, setDescription] = useState('')
  const [initialRevisionNotes, setInitialRevisionNotes] = useState('')

  // Inline floor creation
  const [showAddFloor, setShowAddFloor] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [newFloorShortName, setNewFloorShortName] = useState('')
  const [isCreatingFloor, setIsCreatingFloor] = useState(false)
  const [localFloors, setLocalFloors] = useState<Floor[]>(initialFloors)

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync floors from prop
  useEffect(() => {
    setLocalFloors(initialFloors)
  }, [initialFloors])

  // Initialize form from editDrawing or reset
  useEffect(() => {
    if (open) {
      if (editDrawing) {
        setDrawingNumber(editDrawing.drawingNumber)
        setTitle(editDrawing.title)
        setDiscipline(editDrawing.discipline)
        setDrawingType(editDrawing.drawingType)
        setFloorId(editDrawing.floorId || '')
        setScale(editDrawing.scale || '')
        setPaperSize(editDrawing.paperSize || '')
        setDropboxPath(editDrawing.dropboxPath || '')
        setFileName(editDrawing.fileName || '')
        setDescription(editDrawing.description || '')
        setInitialRevisionNotes('')
      } else {
        setDrawingNumber('')
        setTitle('')
        setDiscipline('')
        setDrawingType('')
        setFloorId('')
        setScale('')
        setPaperSize('')
        setDropboxPath('')
        setFileName('')
        setDescription('')
        setInitialRevisionNotes('')
      }
      setShowAddFloor(false)
      setNewFloorName('')
      setNewFloorShortName('')
    }
  }, [open, editDrawing])

  // Derive filename from dropbox path
  const derivedFileName = dropboxPath
    ? dropboxPath.split('/').pop() || ''
    : ''

  const displayFileName = fileName || derivedFileName

  const handleRemoveFile = useCallback(() => {
    setDropboxPath('')
    setFileName('')
  }, [])

  const handleCreateFloor = async () => {
    if (!newFloorName.trim() || !newFloorShortName.trim()) return

    setIsCreatingFloor(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/project-files-v2/floors`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newFloorName.trim(),
            shortName: newFloorShortName.trim(),
          }),
        }
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to create floor')
      }

      const newFloor: Floor = await res.json()
      setLocalFloors((prev) => [...prev, newFloor])
      setFloorId(newFloor.id)
      setNewFloorName('')
      setNewFloorShortName('')
      setShowAddFloor(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create floor'
      alert(message)
    } finally {
      setIsCreatingFloor(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!drawingNumber.trim() || !title.trim()) {
      alert('Drawing Number and Title are required.')
      return
    }

    if (!discipline) {
      alert('Please select a discipline.')
      return
    }

    if (!drawingType) {
      alert('Please select a drawing type.')
      return
    }

    setIsSubmitting(true)

    const body: Record<string, unknown> = {
      drawingNumber: drawingNumber.trim(),
      title: title.trim(),
      discipline,
      drawingType,
      floorId: floorId || null,
      scale: scale.trim() || null,
      paperSize: paperSize.trim() || null,
      dropboxPath: dropboxPath.trim() || null,
      fileName: displayFileName || null,
      description: description.trim() || null,
    }

    if (!isEditing && initialRevisionNotes.trim()) {
      body.initialRevisionNotes = initialRevisionNotes.trim()
    }

    try {
      const url = isEditing
        ? `/api/projects/${projectId}/project-files-v2/drawings/${editDrawing!.id}`
        : `/api/projects/${projectId}/project-files-v2/drawings`
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || `Failed to ${isEditing ? 'update' : 'create'} drawing`)
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      alert(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Drawing' : 'New Drawing'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${editDrawing!.drawingNumber}`
              : 'Add a new drawing to this project'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Row: Drawing Number + Title */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Drawing Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={drawingNumber}
                onChange={(e) => setDrawingNumber(e.target.value)}
                placeholder="e.g., A-101"
                className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
                required
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Ground Floor Plan"
                className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
                required
              />
            </div>
          </div>

          {/* Row: Discipline + Drawing Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discipline <span className="text-red-500">*</span>
              </label>
              <Select value={discipline} onValueChange={setDiscipline}>
                <SelectTrigger>
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DISCIPLINE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-block w-2 h-2 rounded-full',
                            cfg.color
                          )}
                        />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Drawing Type <span className="text-red-500">*</span>
              </label>
              <Select value={drawingType} onValueChange={setDrawingType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DRAWING_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Floor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Floor
            </label>
            <Select value={floorId} onValueChange={setFloorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select floor (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {localFloors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.shortName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!showAddFloor ? (
              <button
                type="button"
                onClick={() => setShowAddFloor(true)}
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Floor
              </button>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newFloorName}
                    onChange={(e) => setNewFloorName(e.target.value)}
                    placeholder="Floor name"
                    className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={newFloorShortName}
                    onChange={(e) => setNewFloorShortName(e.target.value)}
                    placeholder="Short name (e.g., GF)"
                    className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={handleCreateFloor}
                    disabled={
                      isCreatingFloor ||
                      !newFloorName.trim() ||
                      !newFloorShortName.trim()
                    }
                    className="h-7 text-xs"
                  >
                    {isCreatingFloor ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    Save Floor
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFloor(false)
                      setNewFloorName('')
                      setNewFloorShortName('')
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Row: Scale + Paper Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scale
              </label>
              <input
                type="text"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                placeholder="e.g., 1:50"
                className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paper Size
              </label>
              <input
                type="text"
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                placeholder="e.g., A1, ARCH D"
                className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Link CAD File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link CAD File
            </label>
            {displayFileName ? (
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate flex-1">
                  {displayFileName}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={dropboxPath}
                    onChange={(e) => setDropboxPath(e.target.value)}
                    placeholder="Dropbox path (e.g., /Projects/Drawings/A-101.dwg)"
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Enter the Dropbox file path. Dropbox browser integration coming soon.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this drawing..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* Initial Revision Notes (create mode only) */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Revision Notes
              </label>
              <textarea
                value={initialRevisionNotes}
                onChange={(e) => setInitialRevisionNotes(e.target.value)}
                placeholder="Notes for Revision 1 (e.g., Initial issue for review)..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400 resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Drawing'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
