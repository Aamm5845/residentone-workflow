import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

let twilioClient: ReturnType<typeof twilio> | null = null

/**
 * Get or initialize the Twilio client
 */
export function getTwilioClient() {
  if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.warn('Twilio credentials not configured. SMS notifications will be disabled.')
    return null
  }

  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken)
  }

  return twilioClient
}

/**
 * Send an SMS notification for a chat mention
 */
export async function sendMentionSMS({
  to,
  mentionedBy,
  stageName,
  projectName,
  message,
  stageId
}: {
  to: string
  mentionedBy: string
  stageName: string
  projectName: string
  message: string
  stageId: string
}) {
  console.log('[Twilio] sendMentionSMS called with:', { to, mentionedBy, stageName, projectName })
  
  const client = getTwilioClient()
  
  if (!client || !twilioPhoneNumber) {
    const error = 'Twilio not configured - client or phone number missing'
    console.error(`[Twilio] ${error}`)
    console.error('[Twilio] Environment check:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasPhoneNumber: !!twilioPhoneNumber
    })
    throw new Error(error)
  }

  // Format the phone number (ensure it has country code)
  let formattedPhone = to
  
  // If phone doesn't start with +, add +1 (US/Canada default)
  if (!to.startsWith('+')) {
    const digitsOnly = to.replace(/\D/g, '')
    formattedPhone = `+1${digitsOnly}`
  }
  
  console.log(`[Twilio] Formatted phone: ${to} -> ${formattedPhone}`)

  // Create the SMS body with mention details
  // Include stage ID in a format we can parse from replies
  const smsBody = `🔔 ${mentionedBy} mentioned you in ${stageName} (${projectName}):\n\n"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"\n\nReply to respond. [Ref: ${stageId.substring(0, 8)}]`

  try {
    console.log(`[Twilio] Sending SMS from ${twilioPhoneNumber} to ${formattedPhone}...`)
    
    // Build message parameters
    const messageParams: any = {
      body: smsBody,
      from: twilioPhoneNumber,
      to: formattedPhone
    }
    
    // Only add statusCallback if APP_URL is set
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL
    if (appUrl && appUrl.startsWith('http')) {
      messageParams.statusCallback = `${appUrl}/api/sms/status`
    }
    
    console.log('[Twilio] Request parameters:', {
      from: messageParams.from,
      to: messageParams.to,
      bodyLength: messageParams.body.length,
      hasStatusCallback: !!messageParams.statusCallback
    })
    
    const sentMessage = await client.messages.create(messageParams)

    console.log('[Twilio] ✅ SMS sent successfully!')
    console.log('[Twilio] Message details:', {
      sid: sentMessage.sid,
      status: sentMessage.status,
      to: sentMessage.to,
      from: sentMessage.from
    })
    return sentMessage
  } catch (error: any) {
    console.error('[Twilio] ❌ Failed to send SMS')
    console.error('[Twilio] Error details:', {
      code: error.code,
      message: error.message,
      status: error.status,
      moreInfo: error.moreInfo
    })
    throw error
  }
}

/**
 * Send an SMS notification for a meeting (invitation or reminder)
 */
export async function sendMeetingSMS({
  to,
  attendeeName,
  meetingTitle,
  meetingDate,
  meetingTime,
  type = 'invitation'
}: {
  to: string
  attendeeName: string
  meetingTitle: string
  meetingDate: string
  meetingTime: string
  type?: 'invitation' | 'reminder'
}) {
  console.log('[Twilio] sendMeetingSMS called with:', { to, attendeeName, meetingTitle, type })

  const client = getTwilioClient()

  if (!client || !twilioPhoneNumber) {
    const error = 'Twilio not configured - client or phone number missing'
    console.error(`[Twilio] ${error}`)
    throw new Error(error)
  }

  // Format the phone number
  let formattedPhone = to
  if (!to.startsWith('+')) {
    const digitsOnly = to.replace(/\D/g, '')
    formattedPhone = `+1${digitsOnly}`
  }

  const emoji = type === 'reminder' ? '⏰' : '📅'
  const label = type === 'reminder' ? 'Meeting Reminder' : 'Meeting Invitation'

  const smsBody = `${emoji} ${label}\n\nHi ${attendeeName},\n\n"${meetingTitle}"\n${meetingDate}\n${meetingTime}\n\n— Meisner Interiors`

  try {
    const messageParams: any = {
      body: smsBody,
      from: twilioPhoneNumber,
      to: formattedPhone
    }

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL
    if (appUrl && appUrl.startsWith('http')) {
      messageParams.statusCallback = `${appUrl}/api/sms/status`
    }

    const sentMessage = await client.messages.create(messageParams)
    console.log(`[Twilio] ✅ Meeting SMS sent to ${attendeeName} (${formattedPhone}), SID: ${sentMessage.sid}`)
    return sentMessage
  } catch (error: any) {
    console.error(`[Twilio] ❌ Failed to send meeting SMS to ${attendeeName}:`, {
      code: error.code,
      message: error.message,
    })
    throw error
  }
}

/**
 * Validate a phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Check if it's a valid length (10 digits for US/Canada, or with country code)
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'))
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  
  return phone
}
