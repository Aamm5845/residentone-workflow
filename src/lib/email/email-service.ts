/**
 * Email Service for ResidentOne Workflow
 * 
 * Uses the existing Resend configuration from the main email service
 */

import { Resend } from 'resend'

export interface EmailData {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  cc?: string[]
  bcc?: string[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// Initialize Resend with your existing configuration
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * Send an email using Resend (your configured email provider)
 */
export async function sendEmail(emailData: EmailData): Promise<EmailResult> {
  try {
    // Check if Resend is configured
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not found, logging email instead of sending')
      console.log('📧 EMAIL TO SEND:')
      console.log('To:', emailData.to)
      console.log('Subject:', emailData.subject)
      console.log('HTML Content:', emailData.html.substring(0, 200) + '...')
      
      return {
        success: true,
        messageId: `mock-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    }

    // Get from address from environment or use default
    const fromAddress = emailData.from || process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@residentone.com'
    
    console.log('📧 Sending phase notification email via Resend:', {
      to: emailData.to,
      subject: emailData.subject,
      from: fromAddress
    })
    
    // Send email using Resend
    const result = await resend.emails.send({
      from: fromAddress,
      to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      ...(emailData.replyTo && { reply_to: emailData.replyTo }),
      ...(emailData.cc && { cc: emailData.cc }),
      ...(emailData.bcc && { bcc: emailData.bcc })
    })
    
    console.log('✅ Phase notification email sent successfully:', result.data?.id)
    
    return {
      success: true,
      messageId: result.data?.id || `resend-${Date.now()}`
    }
    }
    
  } catch (error) {
    console.error('❌ Error sending phase notification email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send multiple emails in batch
 */
export async function sendBatchEmails(emails: EmailData[]): Promise<EmailResult[]> {
  const results: EmailResult[] = []
  
  for (const email of emails) {
    const result = await sendEmail(email)
    results.push(result)
  }
  
  return results
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Get email configuration from environment variables
 */
export function getEmailConfig() {
  return {
    fromEmail: process.env.FROM_EMAIL || 'noreply@residentone.com',
    fromName: process.env.FROM_NAME || 'ResidentOne Workflow',
    replyToEmail: process.env.REPLY_TO_EMAIL || 'support@residentone.com'
  }
}