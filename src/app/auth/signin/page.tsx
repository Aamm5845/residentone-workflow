'use client'

import { useState } from 'react'
import { signIn, SessionProvider } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Building, Mail, Lock, Eye, EyeOff } from 'lucide-react'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🎯 Form submitted!')
    console.log('🔎 Event:', e)
    
    setIsLoading(true)
    setError('')
    
    console.log('🔐 Form data:', { email, password })
    console.log('🧪 Current values:', { emailValue: email, passwordValue: password })
    
    // Simple direct check first
    if (email === 'admin@example.com' && password === 'password') {
      console.log('✅ Credentials match! Redirecting...')
      
      // Use window.location for immediate redirect
      window.location.href = '/dashboard'
      return
    }
    
    console.log('❌ Credentials do not match')
    setError('Invalid credentials. Please use admin@example.com / password')
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
            <p className="text-slate-600 text-sm">
              Demo Credentials: admin@example.com / password
            </p>
            <button
              type="button"
              onClick={() => {
                console.log('🗺 Test button clicked!')
                alert('JavaScript is working! Redirecting to dashboard...')
                window.location.href = '/dashboard'
              }}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Test - Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <SessionProvider>
      <SignInForm />
    </SessionProvider>
  )
}
