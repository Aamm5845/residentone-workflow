import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { listFiles } from '@/lib/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check authentication
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user has Admin or Owner role
    const userRole = (session.user as any).role
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden - Admin or Owner role required' 
      }, { status: 403 })
    }
    
    // List all backup files from Vercel Blob Storage
    const files = await listFiles('backups/database/')
    
    // Filter and format backup files
    const backups = files
      .filter((file: any) => 
        file.pathname.includes('backup-') && 
        file.pathname.endsWith('.json.gz')
      )
      .map((file: any) => ({
        filename: file.pathname.split('/').pop(),
        url: file.url,
        uploadedAt: file.uploadedAt,
        size: file.size,
        pathname: file.pathname
      }))
      .sort((a: any, b: any) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )
    
    return NextResponse.json({
      success: true,
      backups,
      count: backups.length
    })
    
  } catch (error: any) {
    console.error('Failed to list cloud backups:', error)
    
    // If blob storage is not configured or accessible
    if (error.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      return NextResponse.json({ 
        error: 'Cloud storage not configured',
        details: 'Vercel Blob Storage is not available'
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to list cloud backups',
      details: error.message 
    }, { status: 500 })
  }
}
