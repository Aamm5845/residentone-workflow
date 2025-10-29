import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendMentionSMS } from '@/lib/twilio'
import { isValidAuthSession } from '@/lib/attribution'

// POST /api/users/[userId]/phone/test-sms - Send a test SMS to a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is editing their own settings or is an admin/owner
    const canEdit = 
      session.user.id === resolvedParams.userId ||
      ['OWNER', 'ADMIN'].includes(session.user.role as string)

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: resolvedParams.userId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        smsNotificationsEnabled: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has SMS enabled
    if (!targetUser.phoneNumber) {
      return NextResponse.json({ 
        error: 'Phone number not set. Please add a phone number first.' 
      }, { status: 400 })
    }

    if (!targetUser.smsNotificationsEnabled) {
      return NextResponse.json({ 
        error: 'SMS notifications are disabled. Please enable them first.' 
      }, { status: 400 })
    }

    // Send test SMS
    console.log(`[Test SMS] Sending test SMS to ${targetUser.name} at ${targetUser.phoneNumber}`)
    
    try {
      const message = await sendMentionSMS({
        to: targetUser.phoneNumber,
        mentionedBy: 'ResidentOne System',
        stageName: 'Test Message',
        projectName: 'SMS Configuration',
        message: `This is a test SMS notification. Your SMS alerts are working correctly! You'll receive notifications when team members mention you in project chats.`,
        stageId: 'test'
      })

      console.log(`[Test SMS] ✅ Successfully sent to ${targetUser.name}. Message SID: ${message.sid}`)

      return NextResponse.json({
        success: true,
        message: 'Test SMS sent successfully',
        details: {
          to: targetUser.phoneNumber,
          messageSid: message.sid,
          status: message.status
        }
      })

    } catch (twilioError: any) {
      console.error(`[Test SMS] ❌ Twilio error:`, twilioError)
      
      return NextResponse.json({
        error: 'Failed to send SMS. Please check your phone number and try again.',
        details: twilioError.message
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Test SMS] Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
