'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CleanupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleDelete = async (patterns: string[]) => {
    if (!confirm(`Are you sure you want to delete all ${patterns.join(' and ')} files?`)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/cleanup-blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', patterns })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: String(error) })
    } finally {
      setLoading(false)
    }
  }

  const handleList = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/cleanup-blob')
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: String(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Blob Storage Cleanup</CardTitle>
          <CardDescription>Clean up Vercel Blob storage to free up space</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleList} disabled={loading}>
              List Files
            </Button>
            <Button 
              onClick={() => handleDelete(['backups'])} 
              disabled={loading}
              variant="destructive"
            >
              Delete Backups
            </Button>
            <Button 
              onClick={() => handleDelete(['spec-books'])} 
              disabled={loading}
              variant="destructive"
            >
              Delete Spec Books
            </Button>
            <Button 
              onClick={() => handleDelete(['backups', 'spec-books'])} 
              disabled={loading}
              variant="destructive"
            >
              Delete Both
            </Button>
          </div>

          {loading && <p>Loading...</p>}

          {result && (
            <div className="mt-4">
              <pre className="bg-slate-900 text-white p-4 rounded-md overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
