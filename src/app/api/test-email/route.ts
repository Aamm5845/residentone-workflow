import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

// Simple email test route to debug Resend issues
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check environment variables
    const resendApiKey = process.env.RESEND_API_KEY
    const emailFrom = process.env.EMAIL_FROM

    if (!resendApiKey) {
      return NextResponse.json({ 
        error: 'RESEND_API_KEY not configured',
        debug: {
          availableEnvVars: Object.keys(process.env).filter(key => key.includes('EMAIL') || key.includes('RESEND'))
        }
      }, { status: 400 })
    }

    // Try a simple Resend call
    const { Resend } = await import('resend')
    const resend = new Resend(resendApiKey)
    
    const testData = {
      from: emailFrom || 'noreply@resend.dev',
      to: 'test@example.com', // This won't actually send since it's a test email
      subject: '🧪 Test Email from ResidentOne',
      html: '<h1>Test Email</h1><p>This is a test email to verify Resend configuration.</p>'
    }

    // Validate data before sending
    const validationErrors = []
    if (!testData.from || testData.from.trim() === '') {
      validationErrors.push('from field is invalid')
    }
    if (!testData.to || testData.to.trim() === '') {
      validationErrors.push('to field is invalid')
    }
    if (!testData.subject || testData.subject.trim() === '') {
      validationErrors.push('subject field is invalid')
    }
    if (!testData.html || testData.html.trim() === '') {
      validationErrors.push('html field is invalid')
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        validationErrors,
        testData
      }, { status: 400 })
    }
    
    try {
      const result = await resend.emails.send(testData)
      
      return NextResponse.json({
        success: true,
        message: 'Email test completed successfully',
        result: result.data,
        testData: {
          from: testData.from,
          to: testData.to,
          subject: testData.subject,
          htmlLength: testData.html.length
        }
      })
      
    } catch (emailError) {
      console.error('❌ Resend API error:', emailError)
      
      return NextResponse.json({
        error: 'Resend API call failed',
        details: emailError instanceof Error ? {
          name: emailError.name,
          message: emailError.message
        } : 'Unknown error',
        testData
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Email test failed:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
