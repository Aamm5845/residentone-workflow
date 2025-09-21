'use client'

import React, { useState, useRef, memo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Send, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  MessageSquare, 
  Pin, 
  PinOff, 
  User,
  AtSign,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface Note {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string
    role: string
  }
  mentions: string[]
  tags: Array<{
    id: string
    name: string
    type: string
    color: string
    taggedBy: {
      id: string
      name: string
    }
  }>
  isPinned: boolean
  pinnedBy?: {
    id: string
    name: string
  }
}

interface NotesFeedProps {
  sectionId: string
  notes: Note[]
  onNotesUpdate: () => void
  showPinnedFirst?: boolean
  className?: string
}

interface NoteItemProps {
  note: Note
  onUpdate: () => void
  onDelete: (noteId: string) => void
  onPinToggle: (noteId: string, isPinned: boolean) => void
}

// Individual note item component
const NoteItem = memo(({ note, onUpdate, onDelete, onPinToggle }: NoteItemProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPinning, setIsPinning] = useState(false)

  // Handle note update
  const handleUpdate = async () => {
    if (editContent.trim() === note.content) {
      setIsEditing(false)
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/design/notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commentId: note.id,
          content: editContent.trim()
        })
      })

      if (response.ok) {
        onUpdate()
        setIsEditing(false)
        toast.success('Note updated')
      } else {
        throw new Error('Failed to update note')
      }
    } catch (error) {
      toast.error('Failed to update note')
      setEditContent(note.content) // Reset
    } finally {
      setIsUpdating(false)
    }
  }

  // Handle note delete
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      const response = await fetch(`/api/design/notes?commentId=${note.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onDelete(note.id)
        toast.success('Note deleted')
      } else {
        throw new Error('Failed to delete note')
      }
    } catch (error) {
      toast.error('Failed to delete note')
    }
  }

  // Handle pin toggle
  const handlePinToggle = async () => {
    setIsPinning(true)
    try {
      const response = await fetch('/api/design/pins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetType: 'comment',
          targetId: note.id,
          action: note.isPinned ? 'unpin' : 'pin'
        })
      })

      if (response.ok) {
        onPinToggle(note.id, !note.isPinned)
        toast.success(note.isPinned ? 'Unpinned note' : 'Pinned note')
      } else {
        throw new Error('Failed to toggle pin')
      }
    } catch (error) {
      toast.error('Failed to toggle pin')
    } finally {
      setIsPinning(false)
    }
  }

  // Parse content for mentions and links
  const parseContent = (content: string) => {
    // Simple parsing for @mentions and links
    return content
      .replace(/@(\w+)/g, '<span class="text-blue-600 font-medium">@$1</span>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${
      note.isPinned ? 'ring-2 ring-amber-200 border-amber-300' : ''
    }`}>
      {/* Pin indicator */}
      {note.isPinned && (
        <div className="mb-3">
          <div className="inline-flex items-center bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
            <Pin className="w-3 h-3 mr-1" />
            Pinned Note
          </div>
        </div>
      )}

      {/* Author info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{note.author.name}</p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
              {note.updatedAt !== note.createdAt && ' (edited)'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handlePinToggle}
            disabled={isPinning}
            className={`p-1 rounded hover:bg-gray-100 transition-colors ${
              note.isPinned ? 'text-amber-600' : 'text-gray-400'
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note'}
          >
            {note.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsEditing(true)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit note"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="What are your thoughts on this section?"
              disabled={isUpdating}
            />
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setEditContent(note.content)
                  setIsEditing(false)
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <Button
                onClick={handleUpdate}
                disabled={isUpdating || !editContent.trim()}
                size="sm"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseContent(note.content) }}
          />
        )}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {note.tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mentions */}
      {note.mentions.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <AtSign className="w-3 h-3" />
            <span>Mentioned: {note.mentions.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Pin info */}
      {note.isPinned && note.pinnedBy && (
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <Pin className="w-3 h-3" />
            <span>Pinned by {note.pinnedBy.name}</span>
          </div>
        </div>
      )}
    </div>
  )
})

NoteItem.displayName = 'NoteItem'

// Main NotesFeed component
export function NotesFeed({ 
  sectionId, 
  notes, 
  onNotesUpdate,
  showPinnedFirst = true,
  className = ''
}: NotesFeedProps) {
  const [newNote, setNewNote] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle new note submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || isPosting) return

    setIsPosting(true)
    try {
      const response = await fetch('/api/design/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sectionId,
          content: newNote.trim()
        })
      })

      if (response.ok) {
        setNewNote('')
        onNotesUpdate()
        toast.success('Note added')
        textareaRef.current?.focus()
      } else {
        throw new Error('Failed to add note')
      }
    } catch (error) {
      toast.error('Failed to add note')
    } finally {
      setIsPosting(false)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Sort notes: pinned first, then by creation date
  const sortedNotes = [...notes].sort((a, b) => {
    if (showPinnedFirst) {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className={className}>
      {/* Add new note */}
      <div className="mb-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add a note... Use @username to mention team members"
                disabled={isPosting}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Tip: Use @aaron, @vitor, @sammy, @shaya to mention team members. Press Cmd+Enter to post.
                </p>
                <Button
                  type="submit"
                  disabled={!newNote.trim() || isPosting}
                  size="sm"
                >
                  {isPosting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Post Note
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Notes list */}
      <div className="space-y-4">
        {sortedNotes.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">No notes yet</p>
            <p className="text-sm text-gray-500">Add the first note to get the conversation started</p>
          </div>
        ) : (
          <>
            {sortedNotes.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                onUpdate={onNotesUpdate}
                onDelete={(noteId) => {
                  onNotesUpdate()
                }}
                onPinToggle={(noteId, isPinned) => {
                  onNotesUpdate()
                }}
              />
            ))}
            
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {notes.length} note{notes.length !== 1 ? 's' : ''} in this section
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
