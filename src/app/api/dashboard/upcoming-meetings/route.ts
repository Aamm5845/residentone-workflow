import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/upcoming-meetings
// Returns the next 3 upcoming meetings where the current user is an attendee
export async function GET() {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const meetings = await prisma.meeting.findMany({
      where: {
        orgId: session.user.orgId,
        status: { not: 'CANCELLED' },
        // Only future or today's meetings
        startTime: { gte: now },
        // Only meetings where the current user is an attendee
        attendees: {
          some: {
            userId: session.user.id,
            status: { not: 'DECLINED' },
          },
        },
      },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            client: { select: { id: true, name: true, email: true } },
            contractor: { select: { id: true, businessName: true, contactName: true, email: true, type: true } },
          },
        },
        project: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ startTime: 'asc' }],
      take: 3,
    })

    return NextResponse.json({
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date.toISOString(),
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
        locationType: m.locationType,
        locationDetails: m.locationDetails,
        meetingLink: m.meetingLink,
        projectId: m.projectId,
        project: m.project,
        organizer: m.organizer,
        attendeeCount: m.attendees.length,
        attendees: m.attendees.map((a) => ({
          id: a.id,
          type: a.type,
          status: a.status,
          name: a.user?.name || a.client?.name || a.contractor?.contactName || a.contractor?.businessName || a.externalName || 'Unknown',
        })),
      })),
    })
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}
