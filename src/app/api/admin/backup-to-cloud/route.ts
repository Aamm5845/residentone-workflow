import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/admin/backup-to-cloud - Trigger cron backup manually for authenticated users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Only allow OWNER to create cloud backups
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Unauthorized - OWNER access required' 
      }, { status: 401 })
    }

    console.log(`🔄 Triggering cloud backup for user: ${session.user.email}`)

    // Get the cron secret from environment
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      throw new Error('CRON_SECRET not configured')
    }

    // Call the cron endpoint internally with the secret
    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`
    const cronUrl = `${baseUrl}/api/cron/daily-backup?secret=${cronSecret}`

    console.log(`[CloudBackup] Calling cron endpoint internally`)
    
    const response = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CloudBackup-Manual-Trigger'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[CloudBackup] Cron call failed:`, errorText)
      throw new Error(`Backup failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log(`✅ Cloud backup completed successfully`)

    return NextResponse.json({
      success: true,
      filename: result.filename,
      path: result.path,
      size: result.size,
      duration: result.duration,
      recordCount: result.recordCount,
      tables: result.tables,
      message: `Backup saved to Dropbox successfully`
    })

  } catch (error) {
    console.error('❌ Cloud backup failed:', error)
    return NextResponse.json({ 
      error: 'Cloud backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
