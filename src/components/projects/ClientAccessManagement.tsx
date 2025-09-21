'use client'

import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Link as LinkIcon, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Calendar, 
  Users,
  ExternalLink,
  Shield,
  Activity,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

interface ClientAccessToken {
  id: string
  token: string
  name?: string
  active: boolean
  expiresAt?: string
  createdAt: string
  lastAccessedAt?: string
  accessCount: number
  lastAccessedIP?: string
  createdBy: {
    id: string
    name: string
    email: string
  }
  _count: {
    accessLogs: number
  }
}

interface ClientAccessManagementProps {
  projectId: string
  projectName: string
  clientName: string
}

export default function ClientAccessManagement({ 
  projectId, 
  projectName, 
  clientName 
}: ClientAccessManagementProps) {
  const [tokens, setTokens] = useState<ClientAccessToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenExpiry, setNewTokenExpiry] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    fetchTokens()
  }, [projectId])

  const fetchTokens = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/client-access?projectId=${projectId}`)
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
    try {
      setCreating(true)
      const response = await fetch('/api/client-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          name: newTokenName || `${clientName} - ${projectName}`,
          expiresAt: newTokenExpiry || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setTokens(prev => [data.token, ...prev])
        setShowCreateForm(false)
        setNewTokenName('')
        setNewTokenExpiry('')
        
        // Auto-copy the new token URL
        const tokenUrl = data.url
        await copyToClipboard(tokenUrl)
        setCopiedToken(data.token.token)
        setTimeout(() => setCopiedToken(null), 3000)
      } else {
        const error = await response.json()
        alert(`Failed to create access link: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating token:', error)
      alert('Failed to create access link')
    } finally {
      setCreating(false)
    }
  }

  const deactivateToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to deactivate this access link? The client will no longer be able to use it.')) {
      return
    }

    try {
      const response = await fetch(`/api/client-access?tokenId=${tokenId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchTokens() // Refresh the list
      } else {
        const error = await response.json()
        alert(`Failed to deactivate token: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deactivating token:', error)
      alert('Failed to deactivate access link')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      return false
    }
  }

  const handleCopyToken = async (token: string) => {
    const tokenUrl = `${window.location.origin}/client-progress/${token}`
    const success = await copyToClipboard(tokenUrl)
    if (success) {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 3000)
    } else {
      alert('Failed to copy to clipboard')
    }
  }

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return { status: 'never', color: 'bg-gray-100 text-gray-600', label: 'Never expires' }
    
    const expiry = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', color: 'bg-red-100 text-red-800', label: 'Expired' }
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring', color: 'bg-yellow-100 text-yellow-800', label: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}` }
    } else {
      return { status: 'active', color: 'bg-green-100 text-green-800', label: `Expires ${expiry.toLocaleDateString()}` }
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Client Access Links</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Client Access Links</h3>
            <p className="text-sm text-gray-600">Generate secure links for clients to view project progress</p>
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
                placeholder={`${clientName} - ${projectName}`}
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive name to help you identify this link
              </p>
            </div>
            
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
            Generate secure links to share project progress with your client
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
            const tokenUrl = `${window.location.origin}/client-progress/${token.token}`
            
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
                    <span>This link has expired and is no longer accessible to clients</span>
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
              <li>• Clients can only see approved renderings and completed phases</li>
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