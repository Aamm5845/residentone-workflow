'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthTestData {
  sessionInfo: any
  uploadApiTest: any
  sectionsApiTest: any
  commentsApiTest: any
}

export default function TestAuthPage() {
  const [testData, setTestData] = useState<AuthTestData | null>(null)
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    const results: Partial<AuthTestData> = {}

    try {
      // Test 1: Check session info
      
      const sessionResponse = await fetch('/api/auth/session')
      results.sessionInfo = {
        status: sessionResponse.status,
        ok: sessionResponse.ok,
        data: sessionResponse.ok ? await sessionResponse.json() : await sessionResponse.text()
      }
      
      // Test 2: Test upload API access (GET request)
      
      try {
        const uploadResponse = await fetch('/api/design/upload?sectionId=test-section-id')
        results.uploadApiTest = {
          status: uploadResponse.status,
          ok: uploadResponse.ok,
          data: uploadResponse.ok ? await uploadResponse.json() : await uploadResponse.text()
        }
      } catch (error) {
        results.uploadApiTest = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      
      // Test 3: Test sections API with a POST request
      
      try {
        const sectionsResponse = await fetch('/api/design/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stageId: 'test-stage-id',
            type: 'GENERAL'
          })
        })
        results.sectionsApiTest = {
          status: sectionsResponse.status,
          ok: sectionsResponse.ok,
          data: sectionsResponse.ok ? await sectionsResponse.json() : await sectionsResponse.text()
        }
      } catch (error) {
        results.sectionsApiTest = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      
      // Test 4: Test comments API
      
      try {
        const commentsResponse = await fetch('/api/design/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionId: 'test-section-id',
            content: 'Test comment'
          })
        })
        results.commentsApiTest = {
          status: commentsResponse.status,
          ok: commentsResponse.ok,
          data: commentsResponse.ok ? await commentsResponse.json() : await commentsResponse.text()
        }
      } catch (error) {
        results.commentsApiTest = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      
    } catch (error) {
      console.error('❌ Test error:', error)
    } finally {
      setTestData(results as AuthTestData)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔐 Authentication & API Test
          </h1>
          <p className="text-gray-600 mb-4">
            This page tests authentication and API endpoint access to debug upload and comment issues.
          </p>
          
          <Button 
            onClick={runTests} 
            disabled={loading}
            className="mb-6"
          >
            {loading ? 'Running Tests...' : 'Run Authentication Tests'}
          </Button>
        </div>

        {testData && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(testData.sessionInfo, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload API Test</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(testData.uploadApiTest, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sections API Test</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(testData.sectionsApiTest, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comments API Test</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(testData.commentsApiTest, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
