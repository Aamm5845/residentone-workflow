import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  if (!resend) {
    return NextResponse.json({ error: 'Resend not configured' }, { status: 400 })
  }

  const { to } = await request.json()
  
  const testData = {
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: to || 'test@example.com',
    subject: 'Test Email',
    html: '<h1>Test Email</h1><p>This is a test email to debug validation issues.</p>'
  }

  try {
    const result = await resend.emails.send(testData)
    
    return NextResponse.json({ 
      success: true, 
      messageId: result.data?.id,
      payload: testData
    })
  } catch (error) {
    console.error('❌ Debug email failed:', error)
    
    // Enhanced error logging
    let errorDetails: any = { originalError: error }
    
    if (error && typeof error === 'object') {
      errorDetails = {
        ...errorDetails,
        errorType: typeof error,
        errorConstructor: error.constructor?.name,
        errorKeys: Object.keys(error),
        stringified: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      }
      
      // Resend specific error fields
      if ('name' in error) errorDetails.name = error.name
      if ('message' in error) errorDetails.message = error.message
      if ('statusCode' in error) errorDetails.statusCode = error.statusCode
      if ('errors' in error) errorDetails.errors = error.errors
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: testData,
      errorDetails
    }, { status: 400 })
  }
}
