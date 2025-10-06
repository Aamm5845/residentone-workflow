'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Plus, 
  Copy, 
  ExternalLink, 
  Trash2, 
  Activity, 
  Calendar, 
  Eye, 
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react'

interface Token {
  id: string
  token: string
  name?: string
  active: boolean
  expiresAt?: string | null
  createdAt: string
  lastAccessedAt?: string | null
  accessCount: number
  createdBy: {
    id: string
    name: string
    email: string
  }
}

interface AccessTokenManagementProps {
  entityType: 'project' | 'phase'
  entityId: string
  entityName: string
  defaultName?: string
  showSpecsUrl?: boolean
}

export default function AccessTokenManagement({
  entityType,
  entityId,
  entityName,
  defaultName,
  showSpecsUrl = false
}: AccessTokenManagementProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Form state
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenExpiry, setNewTokenExpiry] = useState('')
  const [newTokenSpecsUrl, setNewTokenSpecsUrl] = useState('')

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
      const payload: any = {
        [queryParam]: entityId,
        name: newTokenName || undefined,
        expiresAt: newTokenExpiry || undefined
      }
      
      if (showSpecsUrl && newTokenSpecsUrl) {
        payload.specsUrl = newTokenSpecsUrl
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
        setShowCreateForm(false)
        setNewTokenName('')
        setNewTokenExpiry('')
        setNewTokenSpecsUrl('')
        
        // Auto-copy the new URL to clipboard
        if (data.url) {
          await navigator.clipboard.writeText(data.url)
          setCopiedToken(data.token.token)
          setTimeout(() => setCopiedToken(null), 3000)
        }
      } else {
        const errorData = await response.json()
        alert(`Failed to create access link: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error creating token:', error)
      alert('Failed to create access link. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const deactivateToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to delete this access link? It will no longer be accessible.')) {
      return
    }

    try {
      const response = await fetch(`${apiPath}?tokenId=${tokenId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchTokens()
      } else {
        alert('Failed to delete access link')
      }
    } catch (error) {
      console.error('Error deactivating token:', error)
      alert('Failed to delete access link')
    }
  }

  const handleCopyToken = async (token: string) => {
    const url = `${window.location.origin}/${urlPath}/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 3000)
    } catch (error) {
      console.error('Failed to copy token:', error)
    }
  }

  const getExpiryStatus = (expiresAt?: string | null) => {
    if (!expiresAt) {
      return { status: 'never', label: 'Never Expires', color: 'bg-gray-100 text-gray-800' }
    }
    
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const diffTime = expiryDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { status: 'expired', label: 'Expired', color: 'bg-red-100 text-red-800' }
    } else if (diffDays <= 7) {
      return { status: 'expiring', label: `Expires in ${diffDays}d`, color: 'bg-yellow-100 text-yellow-800' }
    } else {
      return { status: 'active', label: `Expires ${expiryDate.toLocaleDateString()}`, color: 'bg-green-100 text-green-800' }
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  const title = entityType === 'project' ? 'Client Access Links' : 'Phase Share Links'
  const description = entityType === 'project' 
    ? 'Generate secure links for clients to view project progress'
    : 'Generate secure links to share this phase with others'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Link
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-4">Generate New Access Link</h4>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tokenName">Link Name (Optional)</Label>
              <Input
                id="tokenName"
                placeholder={defaultName || `${entityName} Access`}
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive name to help you identify this link
              </p>
            </div>
            
            {showSpecsUrl && (
              <div>
                <Label htmlFor="tokenSpecsUrl">House Specifications URL (Optional)</Label>
                <Input
                  id="tokenSpecsUrl"
                  type="url"
                  placeholder="https://example.com/house-specs"
                  value={newTokenSpecsUrl}
                  onChange={(e) => setNewTokenSpecsUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Link to 3rd party site showing all house specifications
                </p>
              </div>
            )}
            
            <div>
              <Label htmlFor="tokenExpiry">Expiration Date (Optional)</Label>
              <Input
                id="tokenExpiry"
                type="date"
                value={newTokenExpiry}
                onChange={(e) => setNewTokenExpiry(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for permanent access
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <Button 
                onClick={createToken}
                disabled={creating}
                className="bg-green-600 hover:bg-green-700"
              >
                {creating ? 'Generating...' : 'Generate Link'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewTokenName('')
                  setNewTokenExpiry('')
                  setNewTokenSpecsUrl('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Token List */}
      {tokens.length === 0 ? (
        <div className="text-center py-12">
          <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Access Links</h4>
          <p className="text-gray-600 mb-4">
            Generate secure links to share {entityType === 'project' ? 'project progress with your client' : 'this phase with others'}
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Generate First Link
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tokens.map((token) => {
            const expiryStatus = getExpiryStatus(token.expiresAt)
            const tokenUrl = `${window.location.origin}/${urlPath}/${token.token}`
            
            return (
              <div key={token.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {token.name || `Access Link ${token.token.substring(0, 8)}...`}
                      </h4>
                      <Badge className={`text-xs ${token.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {token.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className={`text-xs ${expiryStatus.color}`}>
                        {expiryStatus.label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created {new Date(token.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Activity className="w-4 h-4" />
                        <span>{token.accessCount} access{token.accessCount !== 1 ? 'es' : ''}</span>
                      </div>
                      {token.lastAccessedAt && (
                        <div className="flex items-center space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>Last: {new Date(token.lastAccessedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                      {tokenUrl}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyToken(token.token)}
                      className={copiedToken === token.token ? 'bg-green-50 text-green-700 border-green-300' : ''}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {copiedToken === token.token ? 'Copied!' : 'Copy'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(tokenUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deactivateToken(token.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
                
                {expiryStatus.status === 'expired' && (
                  <div className="mt-3 flex items-center space-x-2 text-sm text-red-600 bg-red-50 rounded p-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>This link has expired and is no longer accessible</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h5 className="font-semibold text-blue-900 mb-1">Security Information</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Links are unique and cannot be guessed by unauthorized users</li>
              <li>• {entityType === 'project' ? 'Clients can only see approved renderings and completed phases' : 'Viewers can only see read-only phase content'}</li>
              <li>• Access is logged and can be monitored for security</li>
              <li>• Links can be deactivated at any time to revoke access</li>
              <li>• No login is required - the link provides secure access</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}