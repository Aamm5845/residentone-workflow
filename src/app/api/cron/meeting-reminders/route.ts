import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMeetingReminder } from '@/lib/meeting-emails'

// POST /api/cron/meeting-reminders
// Called by Vercel Cron or external scheduler every 5 minutes
export async function POST(req: NextRequest) {
  // Verify cron secret if configured
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Find meetings that need reminders:
    // - Status is SCHEDULED
    // - Reminder not yet sent
    // - Start time is within reminderMinutes from now
    const meetings = await prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSent: false,
        startTime: {
          gte: now, // Not already started
        },
      },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            client: { select: { id: true, name: true, email: true } },
            contractor: { select: { id: true, businessName: true, contactName: true, email: true } },
          },
        },
        project: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true } },
      },
    })

    let totalSent = 0
    const processedMeetings: string[] = []

    for (const meeting of meetings) {
      // Check if meeting starts within its reminderMinutes window
      const reminderTime = new Date(meeting.startTime.getTime() - meeting.reminderMinutes * 60 * 1000)
      if (now < reminderTime) {
        continue // Too early for reminder
      }

      // Build attendees list for email display
      const allAttendees = meeting.attendees
        .map((att: any) => {
          let n: string | null = null
          if (att.user) n = att.user.name
          else if (att.client) n = att.client.name
          else if (att.contractor) n = att.contractor.contactName || att.contractor.businessName
          else if (att.externalName) n = att.externalName
          if (!n) return null
          return { name: n, type: att.type }
        })
        .filter(Boolean)

      // Send reminders to all attendees
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
            totalSent++
          } catch (err) {
            console.error(`Failed to send reminder to ${email}:`, err)
          }
        }
      }

      // Mark reminder as sent
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { reminderSent: true },
      })
      processedMeetings.push(meeting.id)
    }

    return NextResponse.json({
      success: true,
      processed: processedMeetings.length,
      emailsSent: totalSent,
    })
  } catch (error) {
    console.error('Error processing meeting reminders:', error)
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 })
  }
}

// Also support GET for Vercel Cron (it uses GET by default)
export async function GET(req: NextRequest) {
  return POST(req)
}
