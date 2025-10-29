'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2, FolderOpen, Home, CheckSquare, User, FileText } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  type: 'project' | 'room' | 'stage' | 'client' | 'file'
  title: string
  subtitle: string
  href: string
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search function
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([])
        setShowResults(false)
        return
      }

      setIsLoading(true)
      setShowResults(true)

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results || [])
        }
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300) // Debounce

    return () => clearTimeout(searchTimeout)
  }, [query])

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  const handleResultClick = (href: string) => {
    setQuery('')
    setResults([])
    setShowResults(false)
    router.push(href)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <FolderOpen className="w-4 h-4 text-purple-500" />
      case 'client':
        return <User className="w-4 h-4 text-pink-500" />
      case 'room':
        return <Home className="w-4 h-4 text-blue-500" />
      case 'stage':
        return <CheckSquare className="w-4 h-4 text-green-500" />
      case 'file':
        return <FileText className="w-4 h-4 text-orange-500" />
      default:
        return <Search className="w-4 h-4 text-gray-400" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'project':
        return 'Project'
      case 'client':
        return 'Client'
      case 'room':
        return 'Room'
      case 'stage':
        return 'Stage'
      case 'file':
        return 'File'
      default:
        return ''
    }
  }

  return (
    <div className="relative" ref={searchRef}>
      <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-80">
        <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder="Search projects, rooms, or tasks..."
          className="bg-transparent border-none outline-none text-sm flex-1"
        />
        {query && (
          <button
            onClick={handleClear}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin ml-2" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-sm">Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result.href)}
                  className="w-full px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </p>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
