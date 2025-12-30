import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { list } from '@vercel/blob'
import { isBlobConfigured } from '@/lib/blob'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/blob-status
 * Check Vercel Blob storage status and usage
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Blob is configured
    const isConfigured = isBlobConfigured()

    if (!isConfigured) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'BLOB_READ_WRITE_TOKEN is not configured. All uploads go to Dropbox only.',
        recommendation: 'Add BLOB_READ_WRITE_TOKEN to your Vercel environment variables for faster file access.'
      })
    }

    // Get all blobs
    let allBlobs: any[] = []
    let cursor: string | undefined

    do {
      const result = await list({ cursor, limit: 1000 })
      allBlobs = allBlobs.concat(result.blobs)
      cursor = result.cursor
    } while (cursor)

    // Calculate total size
    const totalSize = allBlobs.reduce((sum, blob) => sum + blob.size, 0)
    const totalSizeGB = totalSize / 1024 / 1024 / 1024
    const totalSizeMB = totalSize / 1024 / 1024

    // Group by type
    const byType: Record<string, { count: number; size: number }> = {}
    const byAge: { last24h: number; last7d: number; last30d: number; older: number } = {
      last24h: 0,
      last7d: 0,
      last30d: 0,
      older: 0
    }

    const now = Date.now()
    const day = 24 * 60 * 60 * 1000

    for (const blob of allBlobs) {
      // By type
      const ext = blob.pathname.split('.').pop()?.toLowerCase() || 'unknown'
      if (!byType[ext]) {
        byType[ext] = { count: 0, size: 0 }
      }
      byType[ext].count++
      byType[ext].size += blob.size

      // By age
      const age = now - new Date(blob.uploadedAt).getTime()
      if (age < day) {
        byAge.last24h++
      } else if (age < 7 * day) {
        byAge.last7d++
      } else if (age < 30 * day) {
        byAge.last30d++
      } else {
        byAge.older++
      }
    }

    // Vercel Blob limits (Pro plan = 5GB, Hobby = 1GB)
    const hobbyLimitGB = 1
    const proLimitGB = 5
    const isNearHobbyLimit = totalSizeGB > hobbyLimitGB * 0.8
    const isOverHobbyLimit = totalSizeGB > hobbyLimitGB
    const isNearProLimit = totalSizeGB > proLimitGB * 0.8

    let status = 'healthy'
    let recommendation = ''

    if (isOverHobbyLimit) {
      status = 'warning'
      recommendation = `You are over the Hobby plan limit (${hobbyLimitGB}GB). If on Hobby plan, new uploads may fail. Consider upgrading to Pro or cleaning up old files.`
    } else if (isNearHobbyLimit) {
      status = 'caution'
      recommendation = `You are approaching the Hobby plan limit (${hobbyLimitGB}GB). Consider cleaning up old files or upgrading to Pro.`
    } else if (isNearProLimit) {
      status = 'caution'
      recommendation = `You are approaching the Pro plan limit (${proLimitGB}GB). Consider cleaning up old files.`
    }

    return NextResponse.json({
      success: true,
      configured: true,
      status,
      recommendation,
      usage: {
        totalFiles: allBlobs.length,
        totalSizeMB: totalSizeMB.toFixed(2),
        totalSizeGB: totalSizeGB.toFixed(3),
        hobbyLimitGB,
        proLimitGB,
        usagePercentHobby: ((totalSizeGB / hobbyLimitGB) * 100).toFixed(1),
        usagePercentPro: ((totalSizeGB / proLimitGB) * 100).toFixed(1)
      },
      byType: Object.entries(byType)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 10)
        .map(([type, stats]) => ({
          type,
          count: stats.count,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2)
        })),
      byAge,
      oldestFile: allBlobs.length > 0
        ? allBlobs.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime())[0]
        : null,
      newestFile: allBlobs.length > 0
        ? allBlobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
        : null
    })
  } catch (error: any) {
    console.error('Error checking blob status:', error)

    // Check for specific errors
    if (error.message?.includes('not authorized') || error.message?.includes('unauthorized')) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'BLOB_READ_WRITE_TOKEN is invalid or expired',
        recommendation: 'Generate a new token in your Vercel project settings and update the environment variable.'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to check storage status',
      details: error.message
    }, { status: 500 })
  }
}
