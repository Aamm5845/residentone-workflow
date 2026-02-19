import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMeetingRsvpNotification } from '@/lib/meeting-emails'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/[id]/respond?token=...&action=ACCEPTED|DECLINED
 *
 * Token-based meeting RSVP endpoint (no auth required — used from email links).
 * Token is the attendee ID for simplicity.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const action = searchParams.get('action')

    if (!token || !action) {
      return buildHtmlResponse('Invalid Link', 'This meeting response link is missing required parameters.', 'error')
    }

    if (!['ACCEPTED', 'DECLINED'].includes(action)) {
      return buildHtmlResponse('Invalid Action', 'The response action must be either accept or decline.', 'error')
    }

    // Find the attendee by ID and verify it belongs to this meeting
    const attendee = await prisma.meetingAttendee.findFirst({
      where: {
        id: token,
        meetingId,
      },
      include: {
        meeting: {
          select: {
            title: true,
            date: true,
            startTime: true,
            status: true,
            organizer: { select: { name: true, email: true } },
          }
        },
        user: { select: { name: true } },
        client: { select: { name: true } },
        contractor: { select: { contactName: true, businessName: true } },
      }
    })

    if (!attendee) {
      return buildHtmlResponse('Not Found', 'This meeting invitation was not found. It may have been cancelled or the link is invalid.', 'error')
    }

    if (attendee.meeting.status === 'CANCELLED') {
      return buildHtmlResponse('Meeting Cancelled', `"${attendee.meeting.title}" has been cancelled.`, 'warning')
    }

    const attendeeName = attendee.user?.name
      || attendee.client?.name
      || attendee.contractor?.contactName
      || attendee.contractor?.businessName
      || attendee.externalName
      || 'there'

    const meetingDate = new Date(attendee.meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Toronto',
    })

    // Check if the attendee has already responded
    if (attendee.status === 'ACCEPTED' || attendee.status === 'DECLINED') {
      // Already responded — show a status page without changing anything
      if (attendee.status === 'ACCEPTED') {
        return buildHtmlResponse(
          'Already Confirmed',
          `Hi ${attendeeName}! You've already confirmed your attendance for "${attendee.meeting.title}" on ${meetingDate}. No further action is needed.`,
          'already_confirmed'
        )
      } else {
        return buildHtmlResponse(
          'Already Declined',
          `Hi ${attendeeName}. You've already declined the meeting "${attendee.meeting.title}" on ${meetingDate}. The organizer was notified.`,
          'already_declined'
        )
      }
    }

    // Update the attendee status (only if currently PENDING)
    await prisma.meetingAttendee.update({
      where: { id: token },
      data: { status: action as 'ACCEPTED' | 'DECLINED' },
    })

    // Notify the organizer about the RSVP (fire-and-forget)
    if (attendee.meeting.organizer?.email) {
      sendMeetingRsvpNotification({
        to: attendee.meeting.organizer.email,
        organizerName: attendee.meeting.organizer.name || 'there',
        attendeeName: String(attendeeName),
        action: action as 'ACCEPTED' | 'DECLINED',
        meeting: {
          title: attendee.meeting.title,
          date: attendee.meeting.date,
          startTime: attendee.meeting.startTime,
        },
      }).catch((err) => console.error('Failed to send RSVP notification to organizer:', err))
    }

    if (action === 'ACCEPTED') {
      return buildHtmlResponse(
        'Meeting Confirmed',
        `Thanks ${attendeeName}! You've confirmed your attendance for "${attendee.meeting.title}" on ${meetingDate}.`,
        'success'
      )
    } else {
      return buildHtmlResponse(
        'Meeting Declined',
        `Thanks ${attendeeName}. You've declined the meeting "${attendee.meeting.title}" on ${meetingDate}. The organizer has been notified.`,
        'declined'
      )
    }

  } catch (error) {
    console.error('Error processing meeting response:', error)
    return buildHtmlResponse('Something went wrong', 'We couldn\'t process your response. Please try again or contact the organizer.', 'error')
  }
}

function buildHtmlResponse(title: string, message: string, type: 'success' | 'declined' | 'warning' | 'error' | 'already_confirmed' | 'already_declined') {
  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', icon: '✅', accent: '#166534' },
    declined: { bg: '#fef2f2', border: '#fca5a5', icon: '❌', accent: '#991b1b' },
    warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠️', accent: '#92400e' },
    error: { bg: '#fef2f2', border: '#fca5a5', icon: '❌', accent: '#991b1b' },
    already_confirmed: { bg: '#eff6ff', border: '#93c5fd', icon: '✅', accent: '#1e40af' },
    already_declined: { bg: '#fef2f2', border: '#fca5a5', icon: '❌', accent: '#991b1b' },
  }
  const c = colors[type]

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Meisner Interiors</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px; display: flex; justify-content: center; align-items: flex-start;">
  <div style="max-width: 480px; width: 100%; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center;">
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 28px 32px; text-align: center;">
      <img src="https://app.meisnerinteriors.com/meisnerinteriorlogo.png"
           alt="Meisner Interiors"
           style="max-width: 160px; height: auto; background-color: white; padding: 10px 14px; border-radius: 8px;" />
    </div>
    <div style="padding: 40px 32px;">
      <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: ${c.bg}; border: 2px solid ${c.border}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px;">${c.icon}</div>
      <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: ${c.accent};">${title}</h1>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">${message}</p>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">Meisner Interiors &copy; ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
