import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getTwilioClient, sendMentionSMS } from '@/lib/twilio'

// Temporary debug endpoint to check SMS setup in production
// DELETE THIS FILE after debugging!

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    // Only allow admins/owners
    if (!session?.user || !['OWNER', 'ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check Twilio config
    const twilioClient = getTwilioClient()
    const twilioConfigured = !!twilioClient

    // Get all users with SMS settings
    const users = await prisma.user.findMany({
      where: {
        orgId: { not: null }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        smsNotificationsEnabled: true,
        role: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    const usersEligibleForSMS = users.filter(u => u.phoneNumber && u.smsNotificationsEnabled)

    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      twilioConfigured,
      twilioDetails: {
        hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
        hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'NOT SET'
      },
      totalUsers: users.length,
      usersEligibleForSMS: usersEligibleForSMS.length,
      users: users.map(u => ({
        name: u.name,
        email: u.email,
        role: u.role,
        hasPhone: !!u.phoneNumber,
        phoneNumber: u.phoneNumber || 'NOT SET',
        smsEnabled: u.smsNotificationsEnabled,
        eligible: !!(u.phoneNumber && u.smsNotificationsEnabled)
      }))
    })

  } catch (error: any) {
    console.error('[SMS Debug] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

// POST /api/debug/sms-check - Send test SMS to a specific user
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    // Only allow admins/owners
    if (!session?.user || !['OWNER', 'ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        smsNotificationsEnabled: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.phoneNumber || !user.smsNotificationsEnabled) {
      return NextResponse.json({ 
        error: 'User does not have SMS configured',
        user: {
          name: user.name,
          hasPhone: !!user.phoneNumber,
          smsEnabled: user.smsNotificationsEnabled
        }
      }, { status: 400 })
    }

    // Send test SMS
    console.log(`[Debug Test SMS] Sending to ${user.name} at ${user.phoneNumber}`)
    
    const message = await sendMentionSMS({
      to: user.phoneNumber,
      mentionedBy: 'Debug System',
      stageName: 'SMS Test',
      projectName: 'Configuration Check',
      message: `Test SMS from production! If you receive this, SMS notifications are working correctly.`,
      stageId: 'debug-test'
    })

    return NextResponse.json({
      success: true,
      message: 'Test SMS sent',
      details: {
        user: user.name,
        phone: user.phoneNumber,
        messageSid: message.sid,
        status: message.status
      }
    })

  } catch (error: any) {
    console.error('[Debug Test SMS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
