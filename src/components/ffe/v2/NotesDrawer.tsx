'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  StickyNote, 
  FileText, 
  Calendar,
  Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Note {
  itemId: string
  itemName: string
  notes: string
  sectionName: string
}

interface NotesDrawerProps {
  notes: Note[]
  onClose: () => void
}

export default function NotesDrawer({ notes, onClose }: NotesDrawerProps) {
  // Group notes by section
  const notesBySection = notes.reduce((acc, note) => {
    if (!acc[note.sectionName]) {
      acc[note.sectionName] = []
    }
    acc[note.sectionName].push(note)
    return acc
  }, {} as Record<string, Note[]>)
  
  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes
            <Badge variant="secondary" className="ml-2">
              {notes.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No Notes Yet</h3>
            <p className="text-sm text-gray-600">
              Add notes to FFE items to keep track of important details and decisions.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-6 pb-6">
            <div className="space-y-6">
              {Object.entries(notesBySection).map(([sectionName, sectionNotes]) => (
                <div key={sectionName} className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <h4 className="font-medium text-gray-900">{sectionName}</h4>
                    <Badge variant="outline" className="h-5 text-xs">
                      {sectionNotes.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {sectionNotes.map((note) => (
                      <Card key={note.itemId} className="bg-gray-50 border border-gray-200">
                        <CardContent className="p-4">
                          <div className="mb-2">
                            <h5 className="font-medium text-gray-900 text-sm">
                              {note.itemName}
                            </h5>
                          </div>
                          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {note.notes}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}