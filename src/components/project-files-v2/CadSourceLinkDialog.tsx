'use client'

import { useState, useEffect } from 'react'
import { Loader2, Link2, X, FileCode, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CadSourceLinkDialogProps {
  projectId: string
  drawing: {
    id: string
    drawingNumber: string
    title: string
  }
  existingLink?: {
    cadDropboxPath: string
    cadLayoutName: string | null
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function CadSourceLinkDialog({
  projectId,
  drawing,
  existingLink,
  open,
  onOpenChange,
  onSuccess,
}: CadSourceLinkDialogProps) {
  const [cadDropboxPath, setCadDropboxPath] = useState('')
  const [cadLayoutName, setCadLayoutName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    if (open) {
      setCadDropboxPath(existingLink?.cadDropboxPath || '')
      setCadLayoutName(existingLink?.cadLayoutName || '')
    }
  }, [open, existingLink])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cadDropboxPath.trim()) {
      alert('Please enter the CAD file path.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(
        `/api/projects/${projectId}/project-files-v2/drawings/${drawing.id}/cad-source`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cadDropboxPath: cadDropboxPath.trim(),
            cadLayoutName: cadLayoutName.trim() || null,
          }),
        }
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to link CAD source')
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

  const handleRemove = async () => {
    if (!existingLink) return

    setIsRemoving(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/project-files-v2/drawings/${drawing.id}/cad-source`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        throw new Error('Failed to remove CAD source link')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      alert(message)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-500" />
            Link CAD Source
          </DialogTitle>
          <DialogDescription>
            Link {drawing.drawingNumber} &ldquo;{drawing.title}&rdquo; to its source CAD file for version tracking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* CAD File Path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source CAD File Path <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={cadDropboxPath}
                onChange={(e) => setCadDropboxPath(e.target.value)}
                placeholder="e.g., /Projects/123/1- CAD/E-101.dwg"
                className="w-full h-10 pl-9 pr-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              The Dropbox path to the source DWG/DXF file.
            </p>
          </div>

          {/* Layout Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Layout Name
              <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={cadLayoutName}
              onChange={(e) => setCadLayoutName(e.target.value)}
              placeholder="e.g., E-101 Electrical Plan"
              className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Which layout in the CAD file corresponds to this drawing.
            </p>
          </div>

          {/* Info box */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 leading-relaxed">
            Once linked, the system will track when the CAD file changes in Dropbox and alert you if the plotted PDF may be outdated.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              {existingLink && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  disabled={isRemoving || isSubmitting}
                  onClick={handleRemove}
                >
                  {isRemoving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Remove Link
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || isRemoving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isRemoving}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    {existingLink ? 'Update Link' : 'Link CAD Source'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
