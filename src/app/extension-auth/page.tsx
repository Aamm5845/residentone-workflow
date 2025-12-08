'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Chrome, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function ExtensionAuthPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // When user is already logged in, auto-generate key and close
  useEffect(() => {
    if (session?.user && status === 'authenticated') {
      handleAutoAuth()
    }
  }, [session, status])

  const handleAutoAuth = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Generate API key
      const response = await fetch('/api/extension/auth', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok && data.apiKey) {
        // Store in chrome extension
        sendToExtension(data.apiKey, session?.user)
        setSuccess(true)
        
        // Close tab after short delay
        setTimeout(() => {
          window.close()
        }, 1500)
      } else {
        setError(data.error || 'Failed to authenticate')
      }
    } catch (err) {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    try {
      // Sign in with credentials
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })
      
      if (result?.error) {
        setError('Invalid email or password')
        setIsLoading(false)
        return
      }
      
      // Success - the useEffect will handle the rest when session updates
      // But let's also try to generate the key immediately
      setTimeout(async () => {
        try {
          const response = await fetch('/api/extension/auth', {
            method: 'POST'
          })
          
          const data = await response.json()
          
          if (response.ok && data.apiKey) {
            sendToExtension(data.apiKey, { email })
            setSuccess(true)
            
            // Close tab
            setTimeout(() => {
              window.close()
            }, 1500)
          }
        } catch (err) {
          // Will retry via useEffect
        }
      }, 500)
      
    } catch (err) {
      setError('Connection error. Please try again.')
      setIsLoading(false)
    }
  }

  const sendToExtension = (apiKey: string, user: any) => {
    // Try to communicate with the extension
    try {
      // Method 1: postMessage to parent (if opened by extension)
      if (window.opener) {
        window.opener.postMessage({
          type: 'EXTENSION_AUTH_SUCCESS',
          apiKey,
          user
        }, '*')
      }
      
      // Method 2: Chrome runtime message (if chrome API available)
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'authComplete',
          apiKey,
          user
        }).catch(() => {
          // Extension might not be listening, that's ok
        })
      }
      
      // Method 3: Store in localStorage for extension to pick up
      localStorage.setItem('extension_auth', JSON.stringify({ apiKey, user, timestamp: Date.now() }))
      
    } catch (e) {
      console.log('Could not communicate with extension directly')
    }
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Connected!</h2>
              <p className="text-gray-500">Extension authenticated successfully.</p>
              <p className="text-sm text-gray-400 mt-2">This window will close automatically...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already logged in - auto connecting
  if (session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Connecting Extension...</h2>
              <p className="text-gray-500">Signed in as {session.user.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Chrome className="w-7 h-7 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Sign in to FFE Clipper</CardTitle>
          <CardDescription>
            Use your StudioFlow account to connect
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
