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
  const client = getTwilioClient()
  
  if (!client || !twilioPhoneNumber) {
    throw new Error('Twilio not configured')
  }

  // Format the phone number (ensure it has country code)
  const formattedPhone = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`

  // Create the SMS body with mention details
  const smsBody = `🔔 ${mentionedBy} mentioned you in ${stageName} (${projectName}):\n\n"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"\n\nReply to this message to respond in the chat.`

  try {
    const sentMessage = await client.messages.create({
      body: smsBody,
      from: twilioPhoneNumber,
      to: formattedPhone,
      // Store stageId in status callback for tracking
      statusCallback: `${process.env.APP_URL || process.env.NEXTAUTH_URL}/api/sms/status`
    })

    console.log('SMS sent successfully:', sentMessage.sid)
    return sentMessage
  } catch (error) {
    console.error('Failed to send SMS:', error)
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
