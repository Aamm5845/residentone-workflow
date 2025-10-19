'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, SessionProvider } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building, Mail, Lock, Eye, EyeOff } from 'lucide-react'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for success message from URL params
  useEffect(() => {
    const urlMessage = searchParams.get('message')
    if (urlMessage) {
      setMessage(urlMessage)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsLoading(true)
    setError('')

    try {
      // First check if user exists and their approval status
      const checkResponse = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const checkData = await checkResponse.json()
      
      if (checkData.exists && checkData.approvalStatus === 'PENDING') {
        setError('Your account is pending admin approval. Please wait for approval before signing in.')
        setIsLoading(false)
        return
      }
      
      if (checkData.exists && checkData.approvalStatus === 'REJECTED') {
        setError('Your account has been rejected by an administrator. Please contact support.')
        setIsLoading(false)
        return
      }
      
      // Use NextAuth to authenticate against the database
      const result = await signIn('credentials', {
        email: email,
        password: password,
        redirect: false
      })
      
      if (result?.ok) {
        
        router.push('/dashboard')
        return
      } else if (result?.error) {
        
        setError('Invalid email or password. Please check your credentials.')
      } else {
        
        setError('Authentication failed. Please try again.')
      }
    } catch (authError) {
      console.error('⚠️ Authentication error:', authError)
      setError('Something went wrong. Please try again.')
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 text-white rounded-xl mb-4">
            <Building className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">StudioFlow</h1>
          <p className="text-sm text-slate-600 mt-1">by Meisner Interiors</p>
          <p className="text-slate-600 mt-2">Interior Design Workflow</p>
        </div>

        {/* Sign In Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-600">Sign in to access your projects</p>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <Link
              href="/auth/forgot-password"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Forgot your password?
            </Link>
            
            <div className="border-t border-slate-200 pt-4">
              <p className="text-slate-600 text-sm mb-2">
                Don't have an account?
              </p>
              <Link
                href="/auth/signup"
                className="inline-block bg-white border border-slate-300 hover:border-slate-400 text-slate-700 px-6 py-2 rounded-lg font-medium text-sm"
              >
                Create Account
              </Link>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <SessionProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      }>
        <SignInForm />
      </Suspense>
    </SessionProvider>
  )
}
