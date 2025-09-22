import nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { Resend } from 'resend';
import { generateClientApprovalToken } from './jwt';
import { generateMeisnerDeliveryEmailTemplate, generateFollowUpEmailTemplate, generateConfirmationEmailTemplate } from './email-templates';
import { prisma } from './prisma';

// Email configuration - Resend (preferred), Mailgun, then nodemailer fallbacks
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const mailgun = new Mailgun(formData);
let mg: any = null;

// Initialize Mailgun if API key is available
if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
  mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: process.env.MAILGUN_URL || 'https://api.mailgun.net' // Use EU endpoint if needed
  });
}

// Fallback SMTP transporter for development or when Mailgun is not configured
const createTransporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'localhost', // Use 'localhost' for MailHog
  port: parseInt(process.env.EMAIL_PORT || '1025'), // MailHog port
  secure: false, // true for 465, false for other ports
  auth: process.env.EMAIL_HOST === 'localhost' ? false : {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  },
  // For development with MailHog, disable auth
  ...(process.env.EMAIL_HOST === 'localhost' && {
    ignoreTLS: true,
    secure: false,
    requireTLS: false
  })
});

const transporter = createTransporter();

// Email sending function that tries Resend first, then Mailgun, then SMTP
async function sendEmail(options: { to: string; subject: string; html: string; from?: string; tags?: string[] }) {
  const fromAddress = options.from || process.env.EMAIL_FROM || 'ResidentOne <noreply@residentone.com>';
  
  console.log('📧 Attempting to send email:', {
    to: options.to,
    subject: options.subject,
    from: fromAddress,
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasMailgunKey: !!process.env.MAILGUN_API_KEY,
    resendConfigured: !!resend
  });
  
  // Validate required fields before sending
  if (!options.to || options.to.trim() === '') {
    throw new Error('Recipient email address is required');
  }
  if (!options.subject || options.subject.trim() === '') {
    throw new Error('Email subject is required');
  }
  if (!options.html || options.html.trim() === '') {
    throw new Error('Email content is required');
  }
  if (!fromAddress || fromAddress.trim() === '') {
    throw new Error('From address is required');
  }
  
  // Try Resend first if configured (best deliverability and developer experience)
  if (resend) {
    try {
      console.log('🚀 Sending email via Resend...');
      
      // Additional Resend-specific validation
      const emailData = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        tags: options.tags?.filter(tag => tag && tag.trim() !== '') || []
      };
      
      console.log('📝 Resend email payload:', {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        htmlLength: emailData.html.length,
        tagsCount: emailData.tags.length
      });
      
      const result = await resend.emails.send(emailData);
      console.log('✅ Email sent via Resend:', result.data?.id);
      return { messageId: result.data?.id || 'resend-' + Date.now(), provider: 'resend' };
    } catch (error) {
      console.error('❌ Resend send failed, falling back to Mailgun:', error);
      // Log the specific error for debugging
      if (error instanceof Error) {
        console.error('Resend error details:', {
          message: error.message,
          stack: error.stack
        });
      }
    }
  } else {
    console.log('⚠️ Resend not configured, skipping to Mailgun');
  }
  
  // Try Mailgun as fallback if configured
  if (mg && process.env.MAILGUN_DOMAIN) {
    try {
      console.log('Sending email via Mailgun...');
      const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html
      });
      console.log('Email sent via Mailgun:', result.id);
      return { messageId: result.id, provider: 'mailgun' };
    } catch (error) {
      console.error('Mailgun send failed, falling back to SMTP:', error);
    }
  }
  
  // Fallback to SMTP
  try {
    console.log('Sending email via SMTP...');
    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log('Email sent via SMTP:', info.messageId);
    return { messageId: info.messageId, provider: 'smtp' };
  } catch (error) {
    console.error('SMTP send also failed:', error);
    throw new Error('Failed to send email via both Mailgun and SMTP');
  }
}

interface SendClientApprovalEmailOptions {
  versionId: string;
  clientEmail: string;
  clientName: string;
  projectName: string;
  assets: Array<{ id: string; url: string; includeInEmail: boolean }>;
}

export async function sendClientApprovalEmail(options: SendClientApprovalEmailOptions): Promise<string> {
  try {
    // Create email log record first to get the ID for tracking pixel
    const emailLog = await prisma.emailLog.create({
      data: {
        versionId: options.versionId,
        to: options.clientEmail,
        subject: '', // Will be updated below
        html: '', // Will be updated below
        sentAt: new Date(),
        type: 'DELIVERY'
      }
    });

    // Get version details for enhanced personalization
    const versionDetails = await prisma.clientApprovalVersion.findUnique({
      where: { id: options.versionId },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Generate tracking pixel URL
    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/email/track/${emailLog.id}`;

    // Generate a placeholder approval URL for template compatibility
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const placeholderApprovalUrl = `${baseUrl}/client-progress/placeholder`;
    
    console.log('📧 Generating email template with data:', {
      clientName: options.clientName,
      projectName: options.projectName,
      roomName: versionDetails?.stage?.room?.name || versionDetails?.stage?.room?.type,
      assetCount: options.assets.length
    });

    // Generate email template with enhanced data
    const { subject, html } = generateMeisnerDeliveryEmailTemplate({
      clientName: options.clientName || 'Valued Client',
      projectName: options.projectName || 'Your Project',
      approvalUrl: placeholderApprovalUrl, // Placeholder URL for template compatibility
      assets: options.assets || [],
      trackingPixelUrl,
      roomName: versionDetails?.stage?.room?.name || versionDetails?.stage?.room?.type || 'Room',
      designPhase: 'Design Showcase',
      projectAddress: versionDetails?.stage?.room?.project?.address || undefined
    });

    // Update email log with subject and HTML
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { subject, html }
    });

    // Send email with tags for better organization
    const emailResult = await sendEmail({
      to: options.clientEmail,
      subject,
      html,
      tags: ['client-approval', 'delivery', options.projectName.toLowerCase().replace(/\s+/g, '-')]
    });
    console.log('Email sent:', emailResult.messageId, 'via', emailResult.provider);

    return emailLog.id;

  } catch (error) {
    console.error('🚨 Failed to send client approval email:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to send email';
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      errorMessage = error.message;
    }
    
    throw new Error(`Email sending failed: ${errorMessage}`);
  }
}

export async function sendFollowUpEmail(versionId: string): Promise<void> {
  try {
    // Get the version and related data
    const version = await prisma.clientApprovalVersion.findUnique({
      where: { id: versionId },
      include: {
        assets: true,
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: true
                  }
                }
              }
            }
          }
        },
        newEmailLogs: {
          where: { type: 'DELIVERY' },
          orderBy: { sentAt: 'desc' },
          take: 1
        }
      }
    });

    if (!version || !version.newEmailLogs.length) {
      throw new Error('Version or original email not found');
    }

    const client = version.stage.room.project.client;
    if (!client) {
      throw new Error('Client not found');
    }

    // Generate new token (could reuse the original, but generating fresh for security)
    const token = generateClientApprovalToken({
      versionId: version.id,
      clientEmail: client.email,
      clientName: client.name,
      projectId: version.stage.room.project.id
    });

    const approvalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/approve/${token}`;

    // Create follow-up email log
    const emailLog = await prisma.emailLog.create({
      data: {
        versionId: version.id,
        to: client.email,
        subject: '', // Will be updated below
        html: '', // Will be updated below
        sentAt: new Date(),
        type: 'FOLLOW_UP'
      }
    });

    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/email/track/${emailLog.id}`;

    // Generate follow-up email template
    const { subject, html } = generateFollowUpEmailTemplate({
      clientName: client.name,
      projectName: version.stage.room.project.name,
      approvalUrl,
      assets: version.assets,
      trackingPixelUrl
    });

    // Update email log
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { subject, html }
    });

    // Send email
    await sendEmail({
      to: client.email,
      subject,
      html
    });

    // Update the original version to mark follow-up as sent
    await prisma.clientApprovalVersion.update({
      where: { id: versionId },
      data: { followUpSentAt: new Date() }
    });

    console.log('Follow-up email sent for version:', versionId);

  } catch (error) {
    console.error('Failed to send follow-up email:', error);
    throw error;
  }
}

export async function sendConfirmationEmail(
  versionId: string, 
  decision: 'APPROVED' | 'REVISION_REQUESTED', 
  comments?: string
): Promise<void> {
  try {
    // Get version and client info
    const version = await prisma.clientApprovalVersion.findUnique({
      where: { id: versionId },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!version) {
      throw new Error('Version not found');
    }

    const client = version.stage.room.project.client;
    if (!client) {
      throw new Error('Client not found');
    }

    // Generate confirmation email template
    const { subject, html } = generateConfirmationEmailTemplate({
      clientName: client.name,
      projectName: version.stage.room.project.name,
      decision,
      comments
    });

    // Create email log
    await prisma.emailLog.create({
      data: {
        versionId: version.id,
        to: client.email,
        subject,
        html,
        sentAt: new Date(),
        type: 'CONFIRMATION'
      }
    });

    // Send email
    await sendEmail({
      to: client.email,
      subject,
      html
    });
    console.log('Confirmation email sent for version:', versionId);

  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    throw error;
  }
}
