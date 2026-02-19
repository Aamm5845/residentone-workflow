import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendMeetingReminder } from '@/lib/meeting-emails'
import { sendMeetingSMS } from '@/lib/twilio'

// POST /api/meetings/[id]/remind — Manually send reminder to all attendees
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const meeting = await prisma.meeting.findFirst({
    where: { id, orgId: session.user.orgId, status: 'SCHEDULED' },
    include: {
      attendees: {
        include: {
          user: { select: { id: true, name: true, email: true, phoneNumber: true, smsNotificationsEnabled: true } },
          client: { select: { id: true, name: true, email: true } },
          contractor: { select: { id: true, businessName: true, contactName: true, email: true } },
        },
      },
      project: { select: { id: true, name: true } },
      organizer: { select: { id: true, name: true } },
    },
  })

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found or already cancelled' }, { status: 404 })
  }

  // Build attendees list for email display
  const allAttendees = meeting.attendees
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

  let sentCount = 0

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
        await sendMeetingReminder({
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
            organizerName: meeting.organizer?.name || 'Team',
            projectName: meeting.project?.name,
          },
          attendees: allAttendees,
        })
        sentCount++
      } catch (err) {
        console.error(`Failed to send reminder to ${email}:`, err)
      }
    }

    // Send SMS reminder to team members who have SMS enabled
    if (attendee.user?.phoneNumber && attendee.user?.smsNotificationsEnabled) {
      try {
        const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
          timeZone: 'America/Toronto',
        })
        const timeStr = new Date(meeting.startTime).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true,
          timeZone: 'America/Toronto',
        })
        await sendMeetingSMS({
          to: attendee.user.phoneNumber,
          attendeeName: attendee.user.name || 'there',
          meetingTitle: meeting.title,
          meetingDate: dateStr,
          meetingTime: timeStr,
          type: 'reminder',
        })
      } catch (smsErr) {
        console.error(`Failed to send meeting reminder SMS to ${attendee.user.name}:`, smsErr)
      }
    }
  }

  return NextResponse.json({ success: true, sentCount })
}
