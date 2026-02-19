import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/meetings/[id]/attendees/[attendeeId]
 *
 * Manually update an attendee's RSVP status (no email sent).
 * Only authenticated users in the same org can do this.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingId, attendeeId } = await params
    const body = await request.json()
    const { status } = body

    if (!['ACCEPTED', 'DECLINED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Verify the meeting belongs to this org
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, orgId: session.user.orgId },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Update the attendee status
    const updated = await prisma.meetingAttendee.update({
      where: { id: attendeeId, meetingId },
      data: { status },
    })

    return NextResponse.json({ success: true, attendee: updated })
  } catch (error) {
    console.error('Error updating attendee status:', error)
    return NextResponse.json({ error: 'Failed to update attendee status' }, { status: 500 })
  }
}
