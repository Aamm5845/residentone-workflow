/**
 * Email service wrapper using Resend
 * This file maintains backward compatibility while using the new Resend-based email service
 */
import { sendEmail as sendResendEmail } from '@/lib/email-service'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send email using Resend (via email-service)
 * This is a wrapper for backward compatibility with existing code
 */
export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  try {
    await sendResendEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      // Note: Resend email-service doesn't use text parameter, it extracts from HTML
    })
    return true
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    return false
  }
}

export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<boolean> => {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0; 
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${companyName}</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>You recently requested to reset your password for your ${companyName} account. Click the button below to reset it.</p>
            
            <a href="${resetUrl}" class="button">Reset Your Password</a>
            
            <p>If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
            
            <p>For security reasons, this link will expire in 1 hour.</p>
            
            <hr>
            <p style="font-size: 14px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>This email was sent by ${companyName}</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    Reset Your Password - ${companyName}
    
    You recently requested to reset your password for your ${companyName} account.
    
    To reset your password, click this link: ${resetUrl}
    
    If you did not request a password reset, please ignore this email.
    
    For security reasons, this link will expire in 1 hour.
  `

  return sendEmail({
    to: email,
    subject: `Reset Your Password - ${companyName}`,
    html,
    text
  })
}

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #28a745; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0; 
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${companyName}</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Welcome to ${companyName}! Your account has been successfully created.</p>
            
            <p>You can now access your dashboard and start managing your interior design projects.</p>
            
            <a href="${appUrl}/dashboard" class="button">Access Your Dashboard</a>
            
            <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>Thank you for choosing ${companyName}</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    Welcome to ${companyName}!
    
    Hello ${name}!
    
    Welcome to ${companyName}! Your account has been successfully created.
    
    You can now access your dashboard at: ${appUrl}/dashboard
    
    If you have any questions, please contact our support team.
  `

  return sendEmail({
    to: email,
    subject: `Welcome to ${companyName}!`,
    html,
    text
  })
}
