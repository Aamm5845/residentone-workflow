'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, GitBranch } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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

interface NewRevisionDialogProps {
  projectId: string
  drawing: {
    id: string
    drawingNumber: string
    title: string
    currentRevision: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewRevisionDialog({
  projectId,
  drawing,
  open,
  onOpenChange,
  onSuccess,
}: NewRevisionDialogProps) {
  const nextRevision = drawing.currentRevision + 1

  // Form state
  const [description, setDescription] = useState('')
  const [dropboxPath, setDropboxPath] = useState('')
  const [issuedDate, setIssuedDate] = useState(getTodayISO())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('')
      setDropboxPath('')
      setIssuedDate(getTodayISO())
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim()) {
      alert('Please describe what changed in this revision.')
      return
    }

    setIsSubmitting(true)

    const body: Record<string, unknown> = {
      description: description.trim(),
      issuedDate,
    }

    if (dropboxPath.trim()) {
      body.dropboxPath = dropboxPath.trim()
    }

    try {
      const res = await fetch(
        `/api/projects/${projectId}/project-files-v2/drawings/${drawing.id}/revisions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to create revision')
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-500" />
            New Revision for {drawing.drawingNumber}
          </DialogTitle>
          <DialogDescription>
            Creating Revision {nextRevision} for &ldquo;{drawing.title}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {/* Revision badge */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 mt-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white text-sm font-bold">
            {nextRevision}
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">
              Revision {nextRevision}
            </p>
            <p className="text-xs text-blue-600">
              Current: Rev {drawing.currentRevision}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* What changed? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What changed? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the changes in this revision..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400 resize-none"
              required
              autoFocus
            />
          </div>

          {/* Updated CAD file path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link updated CAD file
              <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={dropboxPath}
              onChange={(e) => setDropboxPath(e.target.value)}
              placeholder="If the CAD file location changed, enter the new path"
              className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 placeholder:text-gray-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Leave blank to keep the existing file link.
            </p>
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue Date
            </label>
            <input
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
            />
          </div>

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
                  Creating...
                </>
              ) : (
                'Create Revision'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
