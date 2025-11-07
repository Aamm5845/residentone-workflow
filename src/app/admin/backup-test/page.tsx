'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, Download } from 'lucide-react'

export default function BackupTestPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testCronBackup = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/cron/daily-backup?secret=test123')
      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || data.details || 'Backup failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const downloadBackup = async () => {
    try {
      window.location.href = '/api/admin/backup'
    } catch (err) {
      setError('Failed to download backup')
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Backup System Test</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Backup to Dropbox</CardTitle>
            <CardDescription>
              This tests the /api/cron/daily-backup endpoint that runs automatically at 2 AM UTC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testCronBackup} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Backup...
                </>
              ) : (
                'Test Dropbox Backup'
              )}
            </Button>

            {result && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="font-semibold mb-2">✅ Backup Successful!</div>
                  <div className="text-sm space-y-1">
                    <div>📁 File: {result.filename}</div>
                    <div>📂 Path: {result.path}</div>
                    <div>💾 Size: {(result.size / 1024 / 1024).toFixed(2)} MB ({(result.size / 1024).toFixed(0)} KB)</div>
                    <div>⏱️ Duration: {result.duration}ms</div>
                    <div>📊 Records: {result.recordCount}</div>
                    {result.tables && <div>📋 Tables: {result.tables}</div>}
                  </div>
                  <div className="mt-3 text-sm font-medium">
                    ✅ Check Dropbox: /Meisner Interiors Team Folder/Software Backups/
                  </div>
                  {result.size < 200000 && (
                    <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800">
                      ⚠️ Warning: Backup size seems too small ({(result.size / 1024).toFixed(0)} KB). This may indicate most tables are empty or not being backed up correctly.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">❌ Backup Failed</div>
                  <div className="text-sm font-mono">{error}</div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Download Local Backup</CardTitle>
            <CardDescription>
              Download a JSON backup of the database (does not upload to Dropbox)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={downloadBackup}
              variant="outline"
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Backup JSON
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cron Job Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Schedule:</span> Every day at 2:00 AM UTC
            </div>
            <div>
              <span className="font-semibold">Endpoint:</span> /api/cron/daily-backup
            </div>
            <div>
              <span className="font-semibold">Destination:</span> /Meisner Interiors Team Folder/Software Backups/
            </div>
            <div>
              <span className="font-semibold">Retention:</span> Last 20 backups
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 font-semibold">⚠️ Important Notes:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-yellow-700">
                <li>Vercel cron jobs only work on Pro plans or higher</li>
                <li>Free plans need external cron services (e.g., cron-job.org)</li>
                <li>Check Vercel Dashboard → Logs for cron execution history</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
