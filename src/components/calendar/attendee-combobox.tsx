'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Search, UserPlus, Users, Building2, HardHat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AttendeeResult {
  id: string
  name: string
  email: string
  type: 'TEAM_MEMBER' | 'CLIENT' | 'CONTRACTOR' | 'SUBCONTRACTOR'
  subtitle: string
}

export interface SelectedAttendee {
  type: 'TEAM_MEMBER' | 'CLIENT' | 'CONTRACTOR' | 'SUBCONTRACTOR' | 'EXTERNAL'
  userId?: string
  clientId?: string
  contractorId?: string
  externalName?: string
  externalEmail?: string
  displayName: string
  displayEmail: string
}

interface AttendeeComboboxProps {
  selected: SelectedAttendee[]
  onChange: (attendees: SelectedAttendee[]) => void
}

export function AttendeeCombobox({ selected, onChange }: AttendeeComboboxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AttendeeResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showExternalForm, setShowExternalForm] = useState(false)
  const [externalName, setExternalName] = useState('')
  const [externalEmail, setExternalEmail] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowExternalForm(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchAttendees = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/meetings/attendees/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
      }
    } catch (err) {
      console.error('Failed to search attendees:', err)
    }
    setIsLoading(false)
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    setIsOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAttendees(value), 300)
  }

  const addAttendee = (result: AttendeeResult) => {
    // Check for duplicates
    const isDuplicate = selected.some((s) => {
      if (result.type === 'TEAM_MEMBER' && s.userId === result.id) return true
      if (result.type === 'CLIENT' && s.clientId === result.id) return true
      if ((result.type === 'CONTRACTOR' || result.type === 'SUBCONTRACTOR') && s.contractorId === result.id) return true
      return false
    })
    if (isDuplicate) return

    const attendee: SelectedAttendee = {
      type: result.type,
      displayName: result.name,
      displayEmail: result.email,
    }

    if (result.type === 'TEAM_MEMBER') attendee.userId = result.id
    else if (result.type === 'CLIENT') attendee.clientId = result.id
    else attendee.contractorId = result.id

    onChange([...selected, attendee])
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  const addExternalAttendee = () => {
    if (!externalName.trim() || !externalEmail.trim()) return
    // Check duplicate
    if (selected.some((s) => s.externalEmail === externalEmail.trim())) return

    onChange([
      ...selected,
      {
        type: 'EXTERNAL',
        externalName: externalName.trim(),
        externalEmail: externalEmail.trim(),
        displayName: externalName.trim(),
        displayEmail: externalEmail.trim(),
      },
    ])
    setExternalName('')
    setExternalEmail('')
    setShowExternalForm(false)
  }

  const removeAttendee = (index: number) => {
    onChange(selected.filter((_, i) => i !== index))
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TEAM_MEMBER': return <Users className="h-3.5 w-3.5" />
      case 'CLIENT': return <Building2 className="h-3.5 w-3.5" />
      case 'CONTRACTOR':
      case 'SUBCONTRACTOR': return <HardHat className="h-3.5 w-3.5" />
      default: return <UserPlus className="h-3.5 w-3.5" />
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'TEAM_MEMBER': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'CLIENT': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'CONTRACTOR': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'SUBCONTRACTOR': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'EXTERNAL': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      default: return ''
    }
  }

  // Filter out already-selected results
  const filteredResults = results.filter((r) => {
    return !selected.some((s) => {
      if (r.type === 'TEAM_MEMBER' && s.userId === r.id) return true
      if (r.type === 'CLIENT' && s.clientId === r.id) return true
      if ((r.type === 'CONTRACTOR' || r.type === 'SUBCONTRACTOR') && s.contractorId === r.id) return true
      return false
    })
  })

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected attendees as chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((att, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getTypeBadgeColor(att.type)}`}
            >
              {getTypeIcon(att.type)}
              <span className="max-w-[120px] truncate">{att.displayName}</span>
              <button
                type="button"
                onClick={() => removeAttendee(i)}
                className="ml-0.5 hover:text-red-400 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search team members, clients, contractors..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (query.length >= 1) setIsOpen(true) }}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Dropdown results */}
      {isOpen && (query.length >= 1 || showExternalForm) && (
        <div className="border rounded-md bg-popover shadow-md max-h-[200px] overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
          )}

          {!isLoading && filteredResults.length === 0 && query.length >= 1 && !showExternalForm && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No results found
            </div>
          )}

          {filteredResults.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors text-sm"
              onClick={() => addAttendee(result)}
            >
              {getTypeIcon(result.type)}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{result.name}</div>
                <div className="text-xs text-muted-foreground truncate">{result.email}</div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${getTypeBadgeColor(result.type)}`}>
                {result.type === 'TEAM_MEMBER' ? 'Team' :
                 result.type === 'CLIENT' ? 'Client' :
                 result.type === 'SUBCONTRACTOR' ? 'Sub' : 'Contractor'}
              </Badge>
            </button>
          ))}

          {/* Add external option */}
          {!showExternalForm && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors text-sm border-t text-muted-foreground"
              onClick={() => setShowExternalForm(true)}
            >
              <UserPlus className="h-4 w-4" />
              Add external attendee
            </button>
          )}

          {/* External attendee form */}
          {showExternalForm && (
            <div className="p-3 border-t space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Add External Attendee</div>
              <Input
                placeholder="Name"
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                type="email"
                placeholder="Email"
                value={externalEmail}
                onChange={(e) => setExternalEmail(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={addExternalAttendee}
                  disabled={!externalName.trim() || !externalEmail.trim()}
                  className="h-7 text-xs"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowExternalForm(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
