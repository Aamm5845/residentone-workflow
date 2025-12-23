import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute should be plenty

// Check if request is authorized (Vercel Cron or secret)
function isAuthorized(req: Request) {
  // Allow Vercel Cron - check for the header
  const vercelCronHeader = req.headers.get('x-vercel-cron')
  const vercelIdHeader = req.headers.get('x-vercel-id')
  
  if (vercelCronHeader) {
    console.log('[Cleanup Issues] Vercel cron header detected:', vercelCronHeader)
    return true
  }
  
  if (vercelIdHeader) {
    console.log('[Cleanup Issues] Vercel ID header detected (fallback auth)')
    return true
  }
  
  // Allow manual trigger with secret
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET) {
    console.log('[Cleanup Issues] Authenticated with CRON_SECRET')
    return true
  }
  
  console.warn('[Cleanup Issues] Authorization failed')
  return false
}

export async function GET(req: Request) {
  // Check authorization
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🧹 Starting resolved issues cleanup...')
    const startTime = Date.now()
    
    // Calculate the cutoff time (24 hours ago)
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    
    // Find all resolved issues older than 24 hours
    const issuesToDelete = await prisma.issue.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: {
          lte: twentyFourHoursAgo
        }
      },
      select: {
        id: true,
        title: true,
        resolvedAt: true
      }
    })
    
    console.log(`Found ${issuesToDelete.length} resolved issues to delete`)
    
    if (issuesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: 'No resolved issues older than 24 hours found'
      })
    }
    
    // Log which issues will be deleted
    issuesToDelete.forEach(issue => {
      console.log(`  🗑️ Deleting: "${issue.title}" (resolved at ${issue.resolvedAt?.toISOString()})`)
    })
    
    // Delete the issues (this will cascade delete comments due to onDelete: Cascade)
    const deleteResult = await prisma.issue.deleteMany({
      where: {
        id: {
          in: issuesToDelete.map(i => i.id)
        }
      }
    })
    
    const duration = Date.now() - startTime
    
    console.log(`✅ Cleanup completed in ${duration}ms`)
    console.log(`🗑️ Deleted ${deleteResult.count} resolved issues`)
    
    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      deletedIssues: issuesToDelete.map(i => ({ id: i.id, title: i.title })),
      duration,
      message: `Deleted ${deleteResult.count} resolved issues that were older than 24 hours`
    })
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    return NextResponse.json({ 
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}





