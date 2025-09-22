import { NextResponse } from 'next/server'
import { getSession } from '@/auth'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check environment variables
    const emailConfig = {
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasMailgunKey: !!process.env.MAILGUN_API_KEY,
      hasMailgunDomain: !!process.env.MAILGUN_DOMAIN,
      hasEmailHost: !!process.env.EMAIL_HOST,
      hasEmailFrom: !!process.env.EMAIL_FROM,
      hasNextPublicBaseUrl: !!process.env.NEXT_PUBLIC_BASE_URL,
      
      // Don't expose actual values, just first/last chars for verification
      resendKeyPreview: process.env.RESEND_API_KEY 
        ? `${process.env.RESEND_API_KEY.substring(0, 6)}...${process.env.RESEND_API_KEY.slice(-4)}`
        : 'Not set',
      
      emailFromValue: process.env.EMAIL_FROM || 'Not set',
      baseUrlValue: process.env.NEXT_PUBLIC_BASE_URL || 'Not set'
    }

    return NextResponse.json({
      success: true,
      message: 'Email configuration check',
      config: emailConfig,
      session: {
        userId: session.user.id,
        userEmail: session.user.email,
        orgId: session.user.orgId
      }
    })
    
  } catch (error) {
    console.error('Email config test error:', error)
    return NextResponse.json({ 
      error: 'Failed to check email configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}