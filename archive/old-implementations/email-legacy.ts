import nodemailer from 'nodemailer'
import * as mg from 'mailgun.js'
import formData from 'form-data'

interface EmailConfig {
  host: string
  port: number
  user: string
  password: string
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// Initialize Mailgun client
const getMailgunClient = () => {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    return null
  }

  const mailgun = new mg.default(formData)
  return mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: process.env.MAILGUN_URL || 'https://api.mailgun.net'
  })
}

// Create reusable transporter object (fallback)
const createTransporter = () => {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || ''
  }

  if (!config.user || !config.password) {
    return null
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  })
}

export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  // Try Mailgun first (production preferred)
  const mgClient = getMailgunClient()
  if (mgClient && process.env.MAILGUN_DOMAIN) {
    try {
      const fromAddress = process.env.MAILGUN_FROM || `noreply@${process.env.MAILGUN_DOMAIN}`
      
      const mailgunOptions = {
        from: `"${process.env.COMPANY_NAME || 'ResidentOne'}" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, '')
      }

      const result = await mgClient.messages.create(process.env.MAILGUN_DOMAIN, mailgunOptions)
      
      return true
    } catch (error) {
      console.error('❌ Mailgun failed, trying SMTP fallback:', error)
    }
  }

  // Fallback to SMTP (development or if Mailgun fails)
  const transporter = createTransporter()
  if (!transporter) {
    console.warn('⚠️ No email configuration available (neither Mailgun nor SMTP)')
    return false
  }

  try {
    
    const info = await transporter.sendMail({
      from: `"${process.env.COMPANY_NAME || 'ResidentOne'}" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })

    return true
  } catch (error) {
    console.error('❌ Failed to send email via SMTP:', error)
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
