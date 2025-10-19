'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { extractMentions } from '@/lib/mentionUtils'
import { useSession } from 'next-auth/react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  rows?: number
  onSubmit?: (text: string, mentions: string[]) => void
  submitLabel?: string
  teamMembers?: TeamMember[]
}

export function MentionTextarea({
  value,
  onChange,
  placeholder = "Type your message... Use @name to mention team members",
  className,
  disabled = false,
  rows = 3,
  onSubmit,
  submitLabel = "Send",
  teamMembers = []
}: MentionTextareaProps) {
  const { data: session } = useSession()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<TeamMember[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)
  const [currentMention, setCurrentMention] = useState('')

  // Load team members on mount
  useEffect(() => {
    if (teamMembers.length === 0) {
      fetchTeamMembers()
    }
  }, [teamMembers.length])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/team/mentions')
      if (response.ok) {
        const data = await response.json()
        // This would be handled by parent component passing teamMembers prop
        
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPosition = e.target.selectionStart
    
    onChange(newValue)
    
    // Check for mention trigger
    const textBeforeCursor = newValue.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      // Check if the @ is at the start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      if (charBeforeAt === ' ' || lastAtIndex === 0) {
        const mentionText = textBeforeCursor.substring(lastAtIndex + 1)
        
        // Check if mention is still being typed (no space after @)
        if (!mentionText.includes(' ')) {
          setMentionStart(lastAtIndex)
          setCurrentMention(mentionText)
          
          // Filter team members based on current mention text
          const filtered = teamMembers.filter(member =>
            member.name.toLowerCase().includes(mentionText.toLowerCase())
          )
          setSuggestions(filtered)
          setShowSuggestions(filtered.length > 0)
          setSelectedSuggestionIndex(0)
          return
        }
      }
    }
    
    // Hide suggestions if no active mention
    setShowSuggestions(false)
  }

  const insertMention = (member: TeamMember) => {
    if (mentionStart === -1) return
    
    const beforeMention = value.substring(0, mentionStart)
    const afterMention = value.substring(mentionStart + currentMention.length + 1) // +1 for the @
    const newValue = `${beforeMention}@${member.name} ${afterMention}`
    
    onChange(newValue)
    setShowSuggestions(false)
    
    // Focus back to textarea and position cursor
    if (textareaRef.current) {
      textareaRef.current.focus()
      const newCursorPosition = beforeMention.length + member.name.length + 2 // +2 for @ and space
      setTimeout(() => {
        textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedSuggestionIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          )
          break
        case 'Tab':
        case 'Enter':
          if (e.key === 'Enter' && e.shiftKey) {
            // Allow Shift+Enter for new lines
            break
          }
          e.preventDefault()
          insertMention(suggestions[selectedSuggestionIndex])
          break
        case 'Escape':
          e.preventDefault()
          setShowSuggestions(false)
          break
      }
    } else if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!onSubmit || !value.trim()) return
    
    // Extract mention names from text (client-side only)
    const mentions = extractMentions(value)
    onSubmit(value, mentions)
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical",
          disabled && "bg-gray-100 cursor-not-allowed",
          className
        )}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((member, index) => (
            <button
              key={member.id}
              type="button"
              className={cn(
                "w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                index === selectedSuggestionIndex && "bg-gray-100"
              )}
              onClick={() => insertMention(member)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{member.name}</div>
                  <div className="text-sm text-gray-500">{member.email}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Submit Button */}
      {onSubmit && (
        <div className="mt-2 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            size="sm"
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

export default MentionTextarea