import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import twilio from 'twilio'

/**
 * Twilio webhook endpoint for incoming SMS replies
 * This endpoint receives SMS replies and posts them to the chat
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from Twilio
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!authToken) {
      console.error('Twilio auth token not configured')
      return NextResponse.json({ error: 'SMS not configured' }, { status: 500 })
    }

    // Get the Twilio signature for validation
    const twilioSignature = request.headers.get('x-twilio-signature') || ''
    const url = request.url
    
    // Parse the form data from Twilio
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Validate the request is from Twilio
    // NOTE: In development or if behind a proxy, validation might fail
    // You can temporarily skip validation for testing
    const shouldValidate = process.env.NODE_ENV === 'production'
    
    if (shouldValidate) {
      const validator = twilio.validateRequest(
        authToken,
        twilioSignature,
        url,
        params
      )

      if (!validator) {
        console.error('[SMS Webhook] Invalid Twilio signature')
        console.error('[SMS Webhook] URL:', url)
        console.error('[SMS Webhook] Signature:', twilioSignature)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      console.log('[SMS Webhook] Skipping signature validation (development mode)')
    }

    // Extract SMS details
    const from = params.From // Phone number of sender
    const body = params.Body // Message body
    const messageSid = params.MessageSid

    console.log('[SMS Webhook] Received SMS:', { from, body, messageSid })

    // Normalize phone number for matching (remove all non-digits)
    const normalizePhone = (phone: string) => phone.replace(/\D/g, '')
    const fromNormalized = normalizePhone(from)
    
    console.log('[SMS Webhook] Looking for user with phone:', { from, normalized: fromNormalized })

    // Find all users with SMS enabled
    const allUsers = await prisma.user.findMany({
      where: {
        phoneNumber: { not: null },
        smsNotificationsEnabled: true,
        orgId: { not: null }
      },
      select: {
        id: true,
        name: true,
        orgId: true,
        phoneNumber: true
      }
    })
    
    // Find user by matching normalized phone numbers
    const user = allUsers.find(u => {
      if (!u.phoneNumber) return false
      const userPhoneNormalized = normalizePhone(u.phoneNumber)
      return userPhoneNormalized === fromNormalized
    })
    
    console.log('[SMS Webhook] Found user:', user ? { id: user.id, name: user.name } : 'NOT FOUND')
    console.log('[SMS Webhook] All users checked:', allUsers.map(u => ({
      name: u.name,
      stored: u.phoneNumber,
      normalized: normalizePhone(u.phoneNumber || '')
    })))

    if (!user) {
      console.error('User not found for phone number:', from)
      // Send a response SMS
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, we couldn't find your account. Please make sure SMS notifications are enabled in your profile.</Message>
</Response>`
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // Find the most recent SMS conversation for this user
    const recentConversation = await prisma.smsConversation.findFirst({
      where: {
        userId: user.id
      },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    })

    console.log('[SMS Webhook] Found conversation:', recentConversation ? {
      stageId: recentConversation.stageId,
      projectName: recentConversation.stage.room.project.name,
      lastMessageAt: recentConversation.lastMessageAt
    } : 'NOT FOUND')

    if (!recentConversation) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>We couldn't find the conversation you're replying to. Please check the app or ask someone to mention you first.</Message>
</Response>`
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // Post the SMS reply as a chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        content: `📱 [SMS Reply] ${body}`,
        authorId: user.id,
        stageId: recentConversation.stageId
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            image: true
          }
        }
      }
    })

    console.log('SMS reply posted to chat:', chatMessage.id)

    // Send a TwiML response confirming receipt
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Your reply has been posted to the chat!</Message>
</Response>`

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Error processing SMS webhook:', error)
    
    // Return a TwiML error response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, there was an error processing your message. Please try again or use the app.</Message>
</Response>`

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

// Twilio expects a 200 response, so we handle GET as well
export async function GET() {
  return NextResponse.json({ 
    message: 'Twilio SMS webhook endpoint',
    status: 'active'
  })
}
