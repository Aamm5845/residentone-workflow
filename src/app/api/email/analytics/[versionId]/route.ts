import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/email/analytics/[versionId] - Get email analytics for a specific version
export async function GET(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { versionId } = await params

    // Get all email logs for this version
    const emailLogs = await prisma.emailLog.findMany({
      where: {
        versionId,
        version: {
          stage: {
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      },
      include: {
        version: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: {
                      include: {
                        client: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      }
    })

    if (emailLogs.length === 0) {
      return NextResponse.json({
        analytics: {
          totalSent: 0,
          totalOpened: 0,
          totalClicked: 0,
          openRate: 0,
          clickRate: 0,
          firstOpenAt: null,
          lastOpenAt: null,
          totalClicks: 0
        },
        emails: []
      })
    }

    // Calculate analytics
    const totalSent = emailLogs.length
    const deliveredEmails = emailLogs.filter(log => log.deliveryStatus === 'SENT' || log.deliveryStatus === 'DELIVERED')
    const failedEmails = emailLogs.filter(log => log.deliveryStatus === 'FAILED' || log.deliveryStatus === 'BOUNCED')
    const totalDelivered = deliveredEmails.length
    const totalFailed = failedEmails.length
    const openedEmails = emailLogs.filter(log => log.openedAt !== null)
    const totalOpened = openedEmails.length
    
    const clickedEmails = emailLogs.filter(log => {
      const metadata = log.metadata as any
      return metadata?.clickCount > 0
    })
    const totalClicked = clickedEmails.length
    
    const totalClicks = emailLogs.reduce((sum, log) => {
      const metadata = log.metadata as any
      return sum + (metadata?.clickCount || 0)
    }, 0)
    
    const downloadedEmails = emailLogs.filter(log => {
      const metadata = log.metadata as any
      return metadata?.downloadCount > 0
    })
    const totalDownloaded = downloadedEmails.length
    
    const totalDownloads = emailLogs.reduce((sum, log) => {
      const metadata = log.metadata as any
      return sum + (metadata?.downloadCount || 0)
    }, 0)

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
    const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0
    const downloadRate = totalOpened > 0 ? (totalDownloaded / totalOpened) * 100 : 0

    const firstOpenAt = openedEmails.length > 0 
      ? openedEmails.reduce((earliest, log) => 
          log.openedAt && (!earliest || log.openedAt < earliest) ? log.openedAt : earliest, 
          null as Date | null
        )
      : null

    const lastOpenAt = openedEmails.length > 0
      ? openedEmails.reduce((latest, log) =>
          log.openedAt && (!latest || log.openedAt > latest) ? log.openedAt : latest,
          null as Date | null
        )
      : null

    const analytics = {
      totalSent,
      totalDelivered,
      totalFailed,
      totalOpened,
      totalClicked,
      totalDownloaded,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      downloadRate: Math.round(downloadRate * 100) / 100,
      firstOpenAt,
      lastOpenAt,
      totalClicks,
      totalDownloads
    }

    const emails = emailLogs.map(log => {
      const metadata = log.metadata as any
      return {
        id: log.id,
        to: log.to,
        subject: log.subject,
        type: log.type,
        sentAt: log.sentAt,
        openedAt: log.openedAt,
        deliveryStatus: log.deliveryStatus || 'PENDING',
        deliveryError: log.deliveryError,
        providerId: log.providerId,
        provider: log.provider,
        deliveredAt: log.deliveredAt,
        clickCount: metadata?.clickCount || 0,
        clicks: metadata?.clicks || [],
        lastClickAt: metadata?.lastClickAt || null,
        downloadCount: metadata?.downloadCount || 0,
        downloads: metadata?.downloads || [],
        lastDownloadAt: metadata?.lastDownloadAt || null
      }
    })

    return NextResponse.json({
      analytics,
      emails,
      version: {
        id: emailLogs[0].version.id,
        version: emailLogs[0].version.version,
        projectName: emailLogs[0].version.stage.room.project.name,
        roomName: emailLogs[0].version.stage.room.name,
        clientName: emailLogs[0].version.stage.room.project.client?.name,
        clientEmail: emailLogs[0].version.stage.room.project.client?.email
      }
    })

  } catch (error) {
    console.error('Error fetching email analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}