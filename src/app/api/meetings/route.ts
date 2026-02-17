import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendMeetingInvitation } from '@/lib/meeting-emails'
import { createZoomMeeting } from '@/lib/zoom'

// GET /api/meetings?month=2025-07
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // e.g. "2025-07"

  let dateFilter: { gte?: Date; lte?: Date } = {}
  if (month) {
    const [year, mon] = month.split('-').map(Number)
    dateFilter = {
      gte: new Date(year, mon - 1, 1),
      lte: new Date(year, mon, 0, 23, 59, 59),
    }
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      orgId: session.user.orgId,
      status: { not: 'CANCELLED' },
      ...(month ? { date: dateFilter } : {}),
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
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  return NextResponse.json({ meetings })
}

// POST /api/meetings
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      locationType,
      locationDetails,
      meetingLink,
      projectId,
      reminderMinutes = 30,
      attendees = [],
      sendInvitations = true,
      autoCreateZoom = false,
    } = body

    if (!title || !date || !startTime || !endTime || !locationType) {
      return NextResponse.json(
        { error: 'Title, date, startTime, endTime, and locationType are required' },
        { status: 400 }
      )
    }

    // Auto-create Zoom meeting if requested and location is virtual
    let finalMeetingLink = meetingLink || null
    let zoomMeetingId: string | null = null

    if (autoCreateZoom && locationType === 'VIRTUAL') {
      try {
        const startDT = new Date(startTime)
        const endDT = new Date(endTime)
        const durationMinutes = Math.max(
          Math.round((endDT.getTime() - startDT.getTime()) / 60000),
          15 // minimum 15 minutes
        )

        const zoomResult = await createZoomMeeting(session.user.orgId!, {
          topic: title,
          startTime: startDT.toISOString(),
          duration: durationMinutes,
          agenda: description || undefined,
        })

        if (zoomResult) {
          finalMeetingLink = zoomResult.joinUrl
          zoomMeetingId = String(zoomResult.meetingId)
        }
      } catch (err) {
        console.error('Zoom auto-create failed (falling back to no link):', err)
        // Non-fatal: meeting still gets created, just without a Zoom link
      }
    }

    // Create meeting with attendees in a transaction
    const meeting = await prisma.$transaction(async (tx) => {
      const newMeeting = await tx.meeting.create({
        data: {
          title,
          description: description || null,
          date: new Date(date),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          locationType,
          locationDetails: locationDetails || null,
          meetingLink: finalMeetingLink,
          zoomMeetingId,
          reminderMinutes,
          projectId: projectId || null,
          organizerId: session.user.id,
          orgId: session.user.orgId!,
        },
      })

      // Auto-include the organizer as a TEAM_MEMBER attendee if not already in the list
      const organizerAlreadyIncluded = attendees.some(
        (att: { type: string; userId?: string }) =>
          att.type === 'TEAM_MEMBER' && att.userId === session.user.id
      )

      const allAttendees = organizerAlreadyIncluded
        ? attendees
        : [
            { type: 'TEAM_MEMBER', userId: session.user.id },
            ...attendees,
          ]

      // Create attendees
      if (allAttendees.length > 0) {
        await tx.meetingAttendee.createMany({
          data: allAttendees.map((att: {
            type: string
            userId?: string
            clientId?: string
            contractorId?: string
            externalName?: string
            externalEmail?: string
          }) => ({
            meetingId: newMeeting.id,
            type: att.type as 'TEAM_MEMBER' | 'CLIENT' | 'CONTRACTOR' | 'SUBCONTRACTOR' | 'EXTERNAL',
            userId: att.userId || null,
            clientId: att.clientId || null,
            contractorId: att.contractorId || null,
            externalName: att.externalName || null,
            externalEmail: att.externalEmail || null,
          })),
        })
      }

      // Fetch the complete meeting with relations
      return tx.meeting.findUnique({
        where: { id: newMeeting.id },
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
      })
    })

    // Send invitation emails in the background (fire-and-forget)
    if (sendInvitations && meeting) {
      sendInvitationEmails(meeting).catch((err) =>
        console.error('Failed to send meeting invitations:', err)
      )
    }

    return NextResponse.json({ meeting }, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}

// Helper: send invitation emails to all attendees
async function sendInvitationEmails(meeting: any) {
  for (const attendee of meeting.attendees) {
    let email: string | null = null
    let name: string | null = null

    if (attendee.user) {
      email = attendee.user.email
      name = attendee.user.name
    } else if (attendee.client) {
      email = attendee.client.email
      name = attendee.client.name
    } else if (attendee.contractor) {
      email = attendee.contractor.email
      name = attendee.contractor.contactName || attendee.contractor.businessName
    } else if (attendee.externalEmail) {
      email = attendee.externalEmail
      name = attendee.externalName
    }

    if (email) {
      try {
        await sendMeetingInvitation({
          to: email,
          attendeeName: name || 'there',
          meeting: {
            title: meeting.title,
            date: meeting.date,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            locationType: meeting.locationType,
            locationDetails: meeting.locationDetails,
            meetingLink: meeting.meetingLink,
            description: meeting.description,
            organizerName: meeting.organizer?.name || 'Team',
            projectName: meeting.project?.name,
          },
        })
      } catch (err) {
        console.error(`Failed to send invitation to ${email}:`, err)
      }
    }
  }
}
