'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function EmailDebugPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testEmailConfig = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      setResult({
        status: response.status,
        success: response.ok,
        data
      })
    } catch (error) {
      setResult({
        status: 'ERROR',
        success: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧪 Email Configuration Debug</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Email Configuration</h2>
          <p className="text-gray-600 mb-4">
            This will test your Resend configuration and show detailed debugging information.
          </p>
          
          <Button 
            onClick={testEmailConfig}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Testing...' : '🔬 Test Email Configuration'}
          </Button>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">
              Test Results {result.success ? '✅' : '❌'}
            </h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium mb-2">Status: {result.status}</h4>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>

              {!result.success && (
                <div className="bg-red-50 border border-red-200 p-4 rounded">
                  <h4 className="font-medium text-red-800 mb-2">🚨 Troubleshooting:</h4>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    <li>Check if RESEND_API_KEY is set in Vercel environment variables</li>
                    <li>Verify EMAIL_FROM is configured (try noreply@resend.dev for testing)</li>
                    <li>Make sure the API key starts with "re_"</li>
                    <li>Check Vercel function logs for detailed errors</li>
                  </ul>
                </div>
              )}

              {result.success && (
                <div className="bg-green-50 border border-green-200 p-4 rounded">
                  <h4 className="font-medium text-green-800 mb-2">✅ Configuration Looks Good!</h4>
                  <p className="text-sm text-green-700">
                    Your Resend configuration appears to be working. If you're still having issues with client approval emails, 
                    check that the client has valid name and email data.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 p-4 rounded mt-6">
          <h4 className="font-medium text-blue-800 mb-2">📝 Quick Setup Guide:</h4>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>Go to Vercel Dashboard → Your Project → Settings → Environment Variables</li>
            <li>Add: <code>RESEND_API_KEY = re_your_api_key</code></li>
            <li>Add: <code>EMAIL_FROM = noreply@resend.dev</code></li>
            <li>Redeploy your app or restart your local server</li>
            <li>Test again using this page</li>
          </ol>
        </div>
      </div>
    </div>
  )
}