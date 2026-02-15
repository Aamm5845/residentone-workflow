'use client'

import { useState, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SubtaskData } from './types'

interface TaskSubtaskListProps {
  taskId: string
  subtasks: SubtaskData[]
  onSubtasksChange: (subtasks: SubtaskData[]) => void
}

export function TaskSubtaskList({
  taskId,
  subtasks,
  onSubtasksChange,
}: TaskSubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const completedCount = subtasks.filter((s) => s.completed).length
  const totalCount = subtasks.length

  const handleToggle = async (subtask: SubtaskData) => {
    const newCompleted = !subtask.completed

    // Optimistic update
    const updatedSubtasks = subtasks.map((s) =>
      s.id === subtask.id ? { ...s, completed: newCompleted } : s
    )
    onSubtasksChange(updatedSubtasks)
    setTogglingIds((prev) => new Set(prev).add(subtask.id))

    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtaskId: subtask.id,
          completed: newCompleted,
        }),
      })

      if (!response.ok) {
        // Revert optimistic update on failure
        const revertedSubtasks = subtasks.map((s) =>
          s.id === subtask.id ? { ...s, completed: !newCompleted } : s
        )
        onSubtasksChange(revertedSubtasks)
      }
    } catch {
      // Revert on network error
      const revertedSubtasks = subtasks.map((s) =>
        s.id === subtask.id ? { ...s, completed: !newCompleted } : s
      )
      onSubtasksChange(revertedSubtasks)
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(subtask.id)
        return next
      })
    }
  }

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = newSubtaskTitle.trim()
    if (!trimmedTitle) return

    setIsAdding(true)

    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      })

      if (!response.ok) {
        throw new Error('Failed to add subtask')
      }

      const data = await response.json()
      onSubtasksChange([...subtasks, data.subtask])
      setNewSubtaskTitle('')
      inputRef.current?.focus()
    } catch {
      // Error handled silently; could add toast here
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    setDeletingIds((prev) => new Set(prev).add(subtaskId))

    try {
      const response = await fetch(
        `/api/tasks/${taskId}/subtasks?subtaskId=${subtaskId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete subtask')
      }

      onSubtasksChange(subtasks.filter((s) => s.id !== subtaskId))
    } catch {
      // Error handled silently
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(subtaskId)
        return next
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Progress text */}
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {completedCount} of {totalCount} completed
        </p>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={() => handleToggle(subtask)}
              disabled={togglingIds.has(subtask.id)}
              className="shrink-0"
            />
            <span
              className={cn(
                'flex-1 text-sm leading-tight',
                subtask.completed && 'line-through text-muted-foreground'
              )}
            >
              {subtask.title}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-6 w-6"
              onClick={() => handleDeleteSubtask(subtask.id)}
              disabled={deletingIds.has(subtask.id)}
            >
              {deletingIds.has(subtask.id) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Add subtask form */}
      <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          placeholder="Add a subtask..."
          className="h-8 text-sm"
          disabled={isAdding}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={isAdding || !newSubtaskTitle.trim()}
          className="shrink-0 h-8 w-8"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
