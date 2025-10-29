'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Copy, 
  ExternalLink, 
  Trash2, 
  Link as LinkIcon
} from 'lucide-react'

interface Token {
  id: string
  token: string
  name?: string
  active: boolean
  createdAt: string
}

interface AccessTokenManagementProps {
  entityType: 'project' | 'phase'
  entityId: string
  entityName: string
}

export default function AccessTokenManagement({
  entityType,
  entityId,
  entityName
}: AccessTokenManagementProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const apiPath = entityType === 'project' ? '/api/client-access' : '/api/phase-access'
  const queryParam = entityType === 'project' ? 'projectId' : 'stageId'
  const urlPath = entityType === 'project' ? 'client-progress' : 'phase-progress'

  useEffect(() => {
    fetchTokens()
  }, [entityId])

  const fetchTokens = async () => {
    try {
      const response = await fetch(`${apiPath}?${queryParam}=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        setTokens(data.tokens || [])
      }
    } catch (error) {
      console.error('Error fetching tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  const createToken = async () => {
    setCreating(true)
    try {
      const payload = {
        [queryParam]: entityId,
        name: `${entityName} Quick Link`
      }

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        await fetchTokens()
        
        // Auto-copy the new URL to clipboard
        if (data.url) {
          await navigator.clipboard.writeText(data.url)
          setCopiedToken(data.token.token)
          setTimeout(() => setCopiedToken(null), 2000)
        }
      } else {
        const errorData = await response.json()
        alert(`Failed to create link: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error creating token:', error)
      alert('Failed to create link. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const deactivateToken = async (tokenId: string) => {
    try {
      const response = await fetch(`${apiPath}?tokenId=${tokenId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchTokens()
      }
    } catch (error) {
      console.error('Error deactivating token:', error)
    }
  }

  const handleCopyToken = async (token: string) => {
    const url = `${window.location.origin}/${urlPath}/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    } catch (error) {
      console.error('Failed to copy token:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Quick link for team sharing</p>
        <Button 
          onClick={createToken}
          disabled={creating}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          {creating ? 'Creating...' : 'Create Link'}
        </Button>
      </div>

      {/* Simple Token List */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          {tokens.map((token) => {
            const tokenUrl = `${window.location.origin}/${urlPath}/${token.token}`
            
            return (
              <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {token.name || 'Quick Link'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(token.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyToken(token.token)}
                    className={copiedToken === token.token ? 'bg-green-50 text-green-700 border-green-300' : ''}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(tokenUrl, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deactivateToken(token.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tokens.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          No links created yet
        </p>
      )}
    </div>
  )
}
