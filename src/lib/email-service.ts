import nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { generateClientApprovalToken } from './jwt';
import { generateMeisnerDeliveryEmailTemplate, generateFollowUpEmailTemplate, generateConfirmationEmailTemplate } from './email-templates';
import { prisma } from './prisma';

// Email configuration - Mailgun for production, nodemailer for development
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

// Email sending function that tries Mailgun first, then falls back to SMTP
async function sendEmail(options: { to: string; subject: string; html: string; from?: string }) {
  const fromAddress = options.from || process.env.EMAIL_FROM || 'ResidentOne <noreply@residentone.com>';
  
  // Try Mailgun first if configured
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
    // Generate JWT token for client approval
    const token = generateClientApprovalToken({
      versionId: options.versionId,
      clientEmail: options.clientEmail,
      clientName: options.clientName,
      projectId: options.versionId // Using versionId as projectId for now
    });

    // Generate approval URL
    const approvalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/approve/${token}`;

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

    // Generate trackable approval URL
    const trackableApprovalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/email/click/${emailLog.id}?url=${encodeURIComponent(approvalUrl)}`;

    // Generate email template with enhanced data
    const { subject, html } = generateMeisnerDeliveryEmailTemplate({
      clientName: options.clientName,
      projectName: options.projectName,
      approvalUrl: trackableApprovalUrl,
      assets: options.assets,
      trackingPixelUrl,
      roomName: versionDetails?.stage?.room?.name || versionDetails?.stage?.room?.type,
      designPhase: 'Client Approval',
      projectAddress: versionDetails?.stage?.room?.project?.address || undefined
    });

    // Update email log with subject and HTML
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { subject, html }
    });

    // Send email
    const emailResult = await sendEmail({
      to: options.clientEmail,
      subject,
      html
    });
    console.log('Email sent:', emailResult.messageId, 'via', emailResult.provider);

    return emailLog.id;

  } catch (error) {
    console.error('Failed to send client approval email:', error);
    throw new Error('Failed to send email');
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
