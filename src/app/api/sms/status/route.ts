import { NextRequest, NextResponse } from 'next/server'

/**
 * Twilio status callback endpoint
 * Receives delivery status updates for sent SMS messages
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    const messageSid = params.MessageSid
    const messageStatus = params.MessageStatus // queued, sent, delivered, failed, undelivered
    const to = params.To
    const errorCode = params.ErrorCode
    const errorMessage = params.ErrorMessage

    console.log('SMS Status Update:', {
      messageSid,
      messageStatus,
      to,
      errorCode,
      errorMessage
    })

    // You can log this to your database if needed
    // For now, we just log it to console

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing SMS status callback:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Twilio SMS status callback endpoint',
    status: 'active'
  })
}
