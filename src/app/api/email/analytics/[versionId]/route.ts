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

    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0

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
      totalOpened,
      totalClicked,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      firstOpenAt,
      lastOpenAt,
      totalClicks
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
        clickCount: metadata?.clickCount || 0,
        clicks: metadata?.clicks || [],
        lastClickAt: metadata?.lastClickAt || null
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