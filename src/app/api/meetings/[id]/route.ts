import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendMeetingCancellation, sendMeetingUpdate } from '@/lib/meeting-emails'
import { updateZoomMeeting, deleteZoomMeeting } from '@/lib/zoom'

const meetingInclude = {
  attendees: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true, email: true } },
      contractor: { select: { id: true, businessName: true, contactName: true, email: true, type: true } },
    },
  },
  project: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, email: true } },
}

// GET /api/meetings/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const meeting = await prisma.meeting.findFirst({
    where: { id, orgId: session.user.orgId },
    include: meetingInclude,
  })

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  return NextResponse.json({ meeting })
}

// PATCH /api/meetings/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await prisma.meeting.findFirst({
      where: { id, orgId: session.user.orgId },
      include: meetingInclude,
    })

    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

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
      reminderMinutes,
      status,
      attendees,
      sendUpdateEmails = true,
    } = body

    const meeting = await prisma.$transaction(async (tx) => {
      // Update meeting fields
      const updateData: Record<string, unknown> = {}
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (date !== undefined) updateData.date = new Date(date)
      if (startTime !== undefined) updateData.startTime = new Date(startTime)
      if (endTime !== undefined) updateData.endTime = new Date(endTime)
      if (locationType !== undefined) updateData.locationType = locationType
      if (locationDetails !== undefined) updateData.locationDetails = locationDetails
      if (meetingLink !== undefined) updateData.meetingLink = meetingLink
      if (projectId !== undefined) updateData.projectId = projectId || null
      if (reminderMinutes !== undefined) updateData.reminderMinutes = reminderMinutes
      if (status !== undefined) updateData.status = status

      // If date/time changed, reset reminder
      if (date !== undefined || startTime !== undefined) {
        updateData.reminderSent = false
      }

      await tx.meeting.update({
        where: { id },
        data: updateData,
      })

      // Replace attendees if provided
      if (attendees !== undefined) {
        await tx.meetingAttendee.deleteMany({ where: { meetingId: id } })

        // Auto-include the organizer as a TEAM_MEMBER attendee if not already in the list
        const organizerId = existing.organizerId
        const organizerAlreadyIncluded = attendees.some(
          (att: { type: string; userId?: string }) =>
            att.type === 'TEAM_MEMBER' && att.userId === organizerId
        )

        const allAttendees = organizerAlreadyIncluded
          ? attendees
          : [
              { type: 'TEAM_MEMBER', userId: organizerId },
              ...attendees,
            ]

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
              meetingId: id,
              type: att.type as 'TEAM_MEMBER' | 'CLIENT' | 'CONTRACTOR' | 'SUBCONTRACTOR' | 'EXTERNAL',
              userId: att.userId || null,
              clientId: att.clientId || null,
              contractorId: att.contractorId || null,
              externalName: att.externalName || null,
              externalEmail: att.externalEmail || null,
            })),
          })
        }
      }

      return tx.meeting.findUnique({
        where: { id },
        include: meetingInclude,
      })
    })

    // Update Zoom meeting if one was auto-created and relevant fields changed
    if (existing.zoomMeetingId && (title || startTime || endTime || description !== undefined)) {
      const newStart = startTime ? new Date(startTime) : existing.startTime
      const newEnd = endTime ? new Date(endTime) : existing.endTime
      const durationMinutes = Math.max(
        Math.round((newEnd.getTime() - newStart.getTime()) / 60000),
        15
      )

      updateZoomMeeting(session.user.orgId!, existing.zoomMeetingId, {
        topic: title || undefined,
        startTime: startTime ? newStart.toISOString() : undefined,
        duration: durationMinutes,
        agenda: description !== undefined ? (description || '') : undefined,
      }).catch((err) => console.error('Failed to update Zoom meeting:', err))
    }

    // Send update emails in background
    if (sendUpdateEmails && meeting) {
      sendUpdateEmailsToAttendees(meeting).catch((err) =>
        console.error('Failed to send meeting update emails:', err)
      )
    }

    return NextResponse.json({ meeting })
  } catch (error) {
    console.error('Error updating meeting:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}

// DELETE /api/meetings/[id] — Cancels the meeting (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.meeting.findFirst({
    where: { id, orgId: session.user.orgId },
    include: meetingInclude,
  })

  if (!existing) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  // Delete Zoom meeting if one was auto-created
  if (existing.zoomMeetingId) {
    deleteZoomMeeting(session.user.orgId!, existing.zoomMeetingId).catch((err) =>
      console.error('Failed to delete Zoom meeting:', err)
    )
  }

  await prisma.meeting.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  // Send cancellation emails in background
  sendCancellationEmails(existing).catch((err) =>
    console.error('Failed to send meeting cancellation emails:', err)
  )

  return NextResponse.json({ success: true })
}

// Helper functions
function getAttendeeEmailAndName(attendee: any): { email: string | null; name: string | null } {
  if (attendee.user) return { email: attendee.user.email, name: attendee.user.name }
  if (attendee.client) return { email: attendee.client.email, name: attendee.client.name }
  if (attendee.contractor) return { email: attendee.contractor.email, name: attendee.contractor.contactName || attendee.contractor.businessName }
  if (attendee.externalEmail) return { email: attendee.externalEmail, name: attendee.externalName }
  return { email: null, name: null }
}

function getAttendeesList(meeting: any): { name: string; type: string }[] {
  return meeting.attendees
    .map((att: any) => {
      let name: string | null = null
      if (att.user) name = att.user.name
      else if (att.client) name = att.client.name
      else if (att.contractor) name = att.contractor.contactName || att.contractor.businessName
      else if (att.externalName) name = att.externalName
      if (!name) return null
      return { name, type: att.type }
    })
    .filter(Boolean)
}

async function sendCancellationEmails(meeting: any) {
  const allAttendees = getAttendeesList(meeting)

  for (const attendee of meeting.attendees) {
    const { email, name } = getAttendeeEmailAndName(attendee)
    if (email) {
      try {
        await sendMeetingCancellation({
          to: email,
          attendeeName: name || 'there',
          meeting: {
            title: meeting.title,
            date: meeting.date,
            startTime: meeting.startTime,
            organizerName: meeting.organizer?.name || 'Team',
          },
          attendees: allAttendees,
        })
      } catch (err) {
        console.error(`Failed to send cancellation to ${email}:`, err)
      }
    }
  }
}

async function sendUpdateEmailsToAttendees(meeting: any) {
  const allAttendees = getAttendeesList(meeting)

  for (const attendee of meeting.attendees) {
    const { email, name } = getAttendeeEmailAndName(attendee)
    if (email) {
      try {
        await sendMeetingUpdate({
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
          attendees: allAttendees,
        })
      } catch (err) {
        console.error(`Failed to send update to ${email}:`, err)
      }
    }
  }
}
