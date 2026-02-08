/**
 * Email service wrapper using Resend
 * This file maintains backward compatibility while using the new Resend-based email service
 */
import { sendEmail as sendResendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

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
    console.error('Failed to send email:', error)
    return false
  }
}

export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<boolean> => {
  const resetUrl = `${getBaseUrl()}/auth/reset-password?token=${resetToken}`
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

export const sendPasswordChangedEmail = async (email: string, name: string): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = getBaseUrl()
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Password Changed - ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #1e293b; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f8fafc; }
          .success-icon { 
            width: 60px; 
            height: 60px; 
            background-color: #22c55e; 
            border-radius: 50%; 
            margin: 0 auto 20px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
          }
          .success-icon::after {
            content: "✓";
            color: white;
            font-size: 30px;
            font-weight: bold;
          }
          .message-box {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .warning-box {
            background-color: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .warning-box p {
            color: #92400e;
            margin: 0;
            font-size: 14px;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1e293b; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0; 
            font-weight: 500;
          }
          .footer { 
            background-color: #1e293b; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #94a3b8;
            border-radius: 0 0 8px 8px;
          }
          .footer a { color: #60a5fa; text-decoration: none; }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>${companyName}</h1>
          </div>
          <div class="content">
            <div class="success-icon"></div>
            <h2 style="text-align: center; color: #1e293b; margin-bottom: 10px;">Password Changed Successfully</h2>
            
            <div class="message-box">
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Hi ${name},
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                Your password for your ${companyName} account has been successfully changed.
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                <strong>Changed at:</strong> ${new Date().toLocaleString()}
              </p>
            </div>

            <div class="warning-box">
              <p>
                <strong>Security Notice:</strong> If you did not make this change, please reset your password immediately or contact our support team.
              </p>
            </div>

            <div style="text-align: center;">
              <a href="${appUrl}/auth/signin" class="button">Sign In to Your Account</a>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent by ${companyName}</p>
            <p>If you have concerns about your account security, please <a href="${appUrl}/auth/forgot-password">reset your password</a>.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    Password Changed Successfully - ${companyName}
    
    Hi ${name},
    
    Your password for your ${companyName} account has been successfully changed.
    
    Changed at: ${new Date().toLocaleString()}
    
    SECURITY NOTICE: If you did not make this change, please reset your password immediately or contact our support team.
    
    Sign in at: ${appUrl}/auth/signin
  `

  return sendEmail({
    to: email,
    subject: `Password Changed Successfully - ${companyName}`,
    html,
    text
  })
}

export const sendIssueResolvedEmail = async (
  email: string, 
  reporterName: string,
  issueTitle: string,
  resolverName: string,
  issueId?: string
): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = getBaseUrl()
  const issueUrl = issueId ? `${appUrl}/preferences?tab=issues&issue=${issueId}` : `${appUrl}/preferences?tab=issues`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Issue Resolved - ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #22c55e; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f8fafc; }
          .success-icon { 
            width: 60px; 
            height: 60px; 
            background-color: #22c55e; 
            border-radius: 50%; 
            margin: 0 auto 20px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
          }
          .success-icon::after {
            content: "✓";
            color: white;
            font-size: 30px;
            font-weight: bold;
          }
          .message-box {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .issue-title {
            background-color: #f1f5f9;
            border-left: 4px solid #22c55e;
            padding: 15px;
            margin: 15px 0;
            font-weight: 500;
            color: #1e293b;
          }
          .info-box {
            background-color: #dbeafe;
            border: 1px solid #3b82f6;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .info-box p {
            color: #1e40af;
            margin: 0;
            font-size: 14px;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #22c55e; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0; 
            font-weight: 500;
          }
          .footer { 
            background-color: #1e293b; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #94a3b8;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>Issue Resolved!</h1>
          </div>
          <div class="content">
            <div class="success-icon"></div>
            <h2 style="text-align: center; color: #1e293b; margin-bottom: 10px;">Good News!</h2>
            
            <div class="message-box">
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Hi ${reporterName},
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                The issue you reported has been marked as <strong style="color: #22c55e;">Resolved</strong> by ${resolverName}.
              </p>
              
              <div class="issue-title">
                "${issueTitle}"
              </div>
            </div>

            <div class="info-box">
              <p>
                <strong>Please verify:</strong> Try the feature again to make sure the fix works for you. If you still experience issues, you can reopen the ticket or create a new one.
              </p>
            </div>

            <div style="text-align: center;">
              <a href="${issueUrl}" class="button">View Issue</a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 20px;">
              Thank you for reporting this issue and helping us improve ${companyName}!
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from ${companyName}</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    Issue Resolved! - ${companyName}
    
    Hi ${reporterName},
    
    Good news! The issue you reported has been marked as Resolved by ${resolverName}.
    
    Issue: "${issueTitle}"
    
    Please verify: Try the feature again to make sure the fix works for you. If you still experience issues, you can reopen the ticket or create a new one.
    
    View issue at: ${issueUrl}
    
    Thank you for reporting this issue and helping us improve ${companyName}!
  `

  return sendEmail({
    to: email,
    subject: `Issue Resolved: "${issueTitle}" - ${companyName}`,
    html,
    text
  })
}

export const sendIssueCreatedEmail = async (
  recipientEmail: string,
  recipientName: string,
  issueTitle: string,
  issueDescription: string,
  reporterName: string,
  priority: string,
  projectName?: string,
  issueId?: string
): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = getBaseUrl()
  const issueUrl = issueId ? `${appUrl}/preferences?tab=issues&issue=${issueId}` : `${appUrl}/preferences?tab=issues`
  
  const priorityColors: Record<string, string> = {
    'LOW': '#22c55e',
    'MEDIUM': '#f59e0b', 
    'HIGH': '#ef4444',
    'URGENT': '#dc2626'
  }
  
  const priorityColor = priorityColors[priority] || '#6b7280'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>New Issue Reported - ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #ef4444; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f8fafc; }
          .bug-icon { 
            width: 60px; 
            height: 60px; 
            background-color: #ef4444; 
            border-radius: 50%; 
            margin: 0 auto 20px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
          }
          .bug-icon::after {
            content: "!";
            font-size: 30px;
          }
          .message-box {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .issue-title {
            background-color: #f1f5f9;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 15px 0;
            font-weight: 500;
            color: #1e293b;
          }
          .issue-description {
            background-color: #fafafa;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 15px;
            margin: 10px 0;
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
          }
          .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            background-color: ${priorityColor};
          }
          .meta-info {
            display: flex;
            gap: 20px;
            margin: 15px 0;
            font-size: 14px;
            color: #64748b;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1e293b; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0; 
            font-weight: 500;
          }
          .footer { 
            background-color: #1e293b; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #94a3b8;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>New Issue Reported</h1>
          </div>
          <div class="content">
            <div class="bug-icon"></div>
            <h2 style="text-align: center; color: #1e293b; margin-bottom: 10px;">Issue Alert</h2>
            
            <div class="message-box">
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Hi ${recipientName},
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                A new issue has been reported by <strong>${reporterName}</strong>${projectName ? ` for project <strong>${projectName}</strong>` : ''}.
              </p>
              
              <div class="issue-title">
                "${issueTitle}"
              </div>
              
              <div class="meta-info">
                <span>Priority: <span class="priority-badge">${priority}</span></span>
                <span>Reported: ${new Date().toLocaleString()}</span>
              </div>
              
              <div class="issue-description">
                ${issueDescription.length > 300 ? issueDescription.substring(0, 300) + '...' : issueDescription}
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${issueUrl}" class="button">View Issue</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from ${companyName}</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    New Issue Reported - ${companyName}
    
    Hi ${recipientName},
    
    A new issue has been reported by ${reporterName}${projectName ? ` for project ${projectName}` : ''}.
    
    Issue: "${issueTitle}"
    Priority: ${priority}
    
    Description:
    ${issueDescription.length > 300 ? issueDescription.substring(0, 300) + '...' : issueDescription}
    
    View the issue at: ${issueUrl}
  `

  return sendEmail({
    to: recipientEmail,
    subject: `New Issue: "${issueTitle}" [${priority}] - ${companyName}`,
    html,
    text
  })
}

export const sendAutoFixNotificationEmail = async (
  recipientEmail: string,
  recipientName: string,
  issueTitle: string,
  fixSummary: string,
  analysis: string,
  commitUrl: string,
  success: boolean,
  isReporter: boolean = false
): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = getBaseUrl()

  const html = success ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Auto-Fix Applied - ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #22c55e; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f8fafc; }
          .message-box {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .issue-title {
            background-color: #f1f5f9;
            border-left: 4px solid #22c55e;
            padding: 15px;
            margin: 15px 0;
            font-weight: 500;
            color: #1e293b;
          }
          .code-box {
            background-color: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            font-family: monospace;
            margin: 15px 0;
          }
          .action-box {
            background-color: #dbeafe;
            border: 1px solid #3b82f6;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .action-box p {
            color: #1e40af;
            margin: 0;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1e293b;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 10px 5px;
            font-weight: 500;
          }
          .button-green {
            background-color: #22c55e;
          }
          .footer {
            background-color: #1e293b;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>Auto-Fix Applied</h1>
          </div>
          <div class="content">
            <div class="message-box">
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Hi ${recipientName},
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                ${isReporter
                  ? 'The issue you reported has been automatically analyzed and a fix has been applied.'
                  : 'An urgent issue has been automatically fixed by our AI system.'}
              </p>

              <div class="issue-title">
                "${issueTitle}"
              </div>

              <h3 style="color: #1e293b; margin-top: 20px;">What was fixed:</h3>
              <p style="color: #475569;">${fixSummary}</p>

              ${analysis ? `
                <h3 style="color: #1e293b; margin-top: 20px;">Analysis:</h3>
                <p style="color: #475569;">${analysis}</p>
              ` : ''}
            </div>

            ${!isReporter ? `
              <div class="action-box">
                <p><strong>Action Required:</strong> Please pull the latest changes to your local repository:</p>
                <div class="code-box">
                  git pull origin main
                </div>
              </div>
            ` : `
              <div class="action-box">
                <p><strong>Please verify:</strong> The fix has been deployed. Please check if the issue is resolved for you.</p>
              </div>
            `}

            <div style="text-align: center;">
              ${commitUrl ? `<a href="${commitUrl}" class="button">View Commit</a>` : ''}
              <a href="${appUrl}/preferences?tab=issues" class="button button-green">View Issue</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from ${companyName}</p>
          </div>
        </div>
      </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Auto-Fix Failed - ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #ef4444; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f8fafc; }
          .message-box {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .issue-title {
            background-color: #f1f5f9;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 15px 0;
            font-weight: 500;
            color: #1e293b;
          }
          .warning-box {
            background-color: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .warning-box p {
            color: #92400e;
            margin: 0;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1e293b;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 500;
          }
          .footer {
            background-color: #1e293b;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>Auto-Fix Could Not Complete</h1>
          </div>
          <div class="content">
            <div class="message-box">
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Hi ${recipientName},
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                The automatic fix system attempted to resolve an urgent issue but was unable to apply a fix.
              </p>

              <div class="issue-title">
                "${issueTitle}"
              </div>

              <h3 style="color: #1e293b; margin-top: 20px;">Reason:</h3>
              <p style="color: #475569;">${fixSummary}</p>

              ${analysis ? `
                <h3 style="color: #1e293b; margin-top: 20px;">Analysis:</h3>
                <p style="color: #475569;">${analysis}</p>
              ` : ''}
            </div>

            <div class="warning-box">
              <p><strong>Manual Review Required:</strong> This issue needs to be reviewed and fixed manually.</p>
            </div>

            <div style="text-align: center;">
              <a href="${appUrl}/preferences?tab=issues" class="button">View Issue</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from ${companyName}</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = success
    ? `
      Auto-Fix Applied - ${companyName}

      Hi ${recipientName},

      ${isReporter
        ? 'The issue you reported has been automatically analyzed and a fix has been applied.'
        : 'An urgent issue has been automatically fixed by our AI system.'}

      Issue: "${issueTitle}"

      What was fixed: ${fixSummary}
      ${analysis ? `Analysis: ${analysis}` : ''}

      ${!isReporter ? 'Action Required: Please pull the latest changes: git pull origin main' : 'Please verify the fix works for you.'}

      ${commitUrl ? `View commit: ${commitUrl}` : ''}
      View issue: ${appUrl}/preferences?tab=issues
    `
    : `
      Auto-Fix Failed - ${companyName}

      Hi ${recipientName},

      The automatic fix system was unable to resolve an urgent issue.

      Issue: "${issueTitle}"

      Reason: ${fixSummary}
      ${analysis ? `Analysis: ${analysis}` : ''}

      Manual review is required.

      View issue: ${appUrl}/preferences?tab=issues
    `

  return sendEmail({
    to: recipientEmail,
    subject: success
      ? `Auto-Fix Applied: "${issueTitle}" - git pull required`
      : `Auto-Fix Failed: "${issueTitle}" - manual review needed`,
    html,
    text
  })
}

export const sendProposalSignedNotification = async (
  recipientEmail: string,
  recipientName: string,
  proposal: {
    proposalNumber: string
    title: string
    clientName: string
    clientEmail: string
    totalAmount: number
    projectName?: string
    projectId?: string
    signedByName: string
    signedAt: Date
  }
): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = getBaseUrl()

  const formattedAmount = proposal.totalAmount.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD'
  })

  const signedDate = new Date(proposal.signedAt).toLocaleString('en-CA', {
    dateStyle: 'long',
    timeStyle: 'short'
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Proposal Signed - ${companyName}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #22c55e; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f8fafc; }
          .success-icon {
            width: 60px;
            height: 60px;
            background-color: #22c55e;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .success-icon::after {
            content: "✓";
            color: white;
            font-size: 30px;
            font-weight: bold;
          }
          .message-box {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #64748b;
            font-size: 14px;
          }
          .detail-value {
            color: #1e293b;
            font-weight: 500;
          }
          .amount-highlight {
            background-color: #dcfce7;
            border: 1px solid #22c55e;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
          }
          .amount-highlight .label {
            color: #166534;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .amount-highlight .value {
            color: #166534;
            font-size: 28px;
            font-weight: bold;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1e293b;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 500;
          }
          .footer {
            background-color: #1e293b;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>Proposal Signed</h1>
          </div>
          <div class="content">
            <div class="success-icon"></div>
            <h2 style="text-align: center; color: #1e293b; margin-bottom: 10px;">Great News!</h2>

            <div class="message-box">
              <p style="color: #475569; line-height: 1.6; margin: 0;">
                Hi ${recipientName},
              </p>
              <p style="color: #475569; line-height: 1.6; margin-top: 15px;">
                A proposal has just been signed by the client!
              </p>

              <div style="margin-top: 20px;">
                <div class="detail-row">
                  <span class="detail-label">Proposal</span>
                  <span class="detail-value">${proposal.proposalNumber}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Title</span>
                  <span class="detail-value">${proposal.title}</span>
                </div>
                ${proposal.projectName ? `
                <div class="detail-row">
                  <span class="detail-label">Project</span>
                  <span class="detail-value">${proposal.projectName}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Client</span>
                  <span class="detail-value">${proposal.clientName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Client Email</span>
                  <span class="detail-value">${proposal.clientEmail}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Signed By</span>
                  <span class="detail-value">${proposal.signedByName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Signed At</span>
                  <span class="detail-value">${signedDate}</span>
                </div>
              </div>

              <div class="amount-highlight">
                <div class="label">Contract Value</div>
                <div class="value">${formattedAmount}</div>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${proposal.projectId ? `${appUrl}/projects/${proposal.projectId}/billing` : `${appUrl}/dashboard`}" class="button">View Proposal</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from ${companyName}</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    Proposal Signed! - ${companyName}

    Hi ${recipientName},

    Great news! A proposal has just been signed by the client.

    Proposal: ${proposal.proposalNumber}
    Title: ${proposal.title}
    ${proposal.projectName ? `Project: ${proposal.projectName}` : ''}
    Client: ${proposal.clientName} (${proposal.clientEmail})
    Signed By: ${proposal.signedByName}
    Signed At: ${signedDate}

    Contract Value: ${formattedAmount}

    View the proposal at: ${proposal.projectId ? `${appUrl}/projects/${proposal.projectId}/billing` : `${appUrl}/dashboard`}
  `

  return sendEmail({
    to: recipientEmail,
    subject: `Proposal Signed: ${proposal.proposalNumber} - ${proposal.clientName} (${formattedAmount})`,
    html,
    text
  })
}

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  const companyName = process.env.COMPANY_NAME || 'StudioFlow'
  const appUrl = getBaseUrl()
  
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
