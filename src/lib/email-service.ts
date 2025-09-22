import nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { Resend } from 'resend';
import { generateClientApprovalToken } from './jwt';
import { generateMeisnerDeliveryEmailTemplate, generateFollowUpEmailTemplate, generateConfirmationEmailTemplate } from './email-templates';
import { prisma } from './prisma';

// Email configuration - Resend (preferred), Mailgun, then nodemailer fallbacks
const resend = (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'YOUR_RESEND_API_KEY_HERE') 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

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
  // Use a more reliable default from address
  const fromAddress = options.from || process.env.EMAIL_FROM || 'onboarding@resend.dev';
  
  console.log('📧 Attempting to send email:', {
    to: options.to,
    subject: options.subject,
    from: fromAddress,
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasMailgunKey: !!process.env.MAILGUN_API_KEY,
    resendConfigured: !!resend,
    emailHostConfigured: !!process.env.EMAIL_HOST
  });
  
  // Check if any email service is configured
  if (!resend && !mg && !process.env.EMAIL_HOST) {
    console.error('⚠️ No email service configured! Please set up Resend, Mailgun, or SMTP.');
    throw new Error('No email service configured. Please set up Resend API key, Mailgun, or SMTP settings.');
  }
  
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
      
      // Additional Resend-specific validation and cleanup
      const cleanTags = options.tags
        ?.filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
        ?.map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'))
        ?.slice(0, 10) || []; // Resend has a limit on tags
      
      // Build email data object without empty/invalid fields
      const emailData: any = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html
      };
      
      // Only add tags if we have valid ones (Resend doesn't like empty arrays)
      if (cleanTags.length > 0) {
        emailData.tags = cleanTags;
      }
      
      console.log('📝 Resend email payload:', {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        htmlLength: emailData.html.length,
        tagsCount: cleanTags.length,
        tags: cleanTags
      });
      
      // Detailed field validation logging
      console.log('🔍 Detailed field analysis:', {
        from: {
          value: emailData.from,
          type: typeof emailData.from,
          length: emailData.from?.length,
          isEmpty: emailData.from === '',
          isNull: emailData.from === null,
          isUndefined: emailData.from === undefined,
          hasSpaces: emailData.from?.includes(' '),
          emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailData.from || '')
        },
        to: {
          value: emailData.to,
          type: typeof emailData.to,
          length: emailData.to?.length,
          isEmpty: emailData.to === '',
          isNull: emailData.to === null,
          isUndefined: emailData.to === undefined,
          isArray: Array.isArray(emailData.to),
          emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailData.to || '')
        },
        subject: {
          value: emailData.subject,
          type: typeof emailData.subject,
          length: emailData.subject?.length,
          isEmpty: emailData.subject === '',
          isNull: emailData.subject === null,
          isUndefined: emailData.subject === undefined,
          hasNewlines: emailData.subject?.includes('\n'),
          hasCarriageReturns: emailData.subject?.includes('\r')
        },
        html: {
          type: typeof emailData.html,
          length: emailData.html?.length,
          isEmpty: emailData.html === '',
          isNull: emailData.html === null,
          isUndefined: emailData.html === undefined,
          startsWithHtml: emailData.html?.toLowerCase().startsWith('<html'),
          containsBody: emailData.html?.toLowerCase().includes('<body')
        },
        tags: {
          value: cleanTags,
          type: typeof cleanTags,
          length: cleanTags.length,
          isArray: Array.isArray(cleanTags),
          hasEmptyStrings: cleanTags.some(tag => tag === ''),
          hasNullUndefined: cleanTags.some(tag => tag === null || tag === undefined)
        }
      });
      
      // Log the exact JSON that will be sent to Resend
      console.log('📤 Exact JSON payload to Resend:', JSON.stringify(emailData, null, 2));
      
      const result = await resend.emails.send(emailData);
      console.log('✅ Email sent via Resend:', result.data?.id);
      return { messageId: result.data?.id || 'resend-' + Date.now(), provider: 'resend' };
    } catch (error) {
      console.error('❌ Resend send failed, falling back to Mailgun:', error);
      
      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Resend error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      // Try to extract more details from the Resend error
      try {
        if (error && typeof error === 'object') {
          console.error('🔍 Full Resend error object:', {
            errorType: typeof error,
            errorConstructor: error.constructor.name,
            errorKeys: Object.keys(error),
            errorValues: error,
            stringified: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
          });
          
          // Check if it's a fetch response error
          if ('response' in error && error.response) {
            console.error('📡 Resend API response error:', error.response);
          }
          
          // Check for status code
          if ('statusCode' in error) {
            console.error('📊 Resend status code:', error.statusCode);
          }
          
          // Check for validation errors
          if ('errors' in error && error.errors) {
            console.error('❗ Resend validation errors:', error.errors);
          }
        }
      } catch (logError) {
        console.error('⚠️ Failed to log detailed error info:', logError);
      }
      
      // Log the payload that caused the error for debugging
      console.error('Failed Resend payload:', {
        from: emailData?.from,
        to: emailData?.to,
        subject: emailData?.subject?.substring(0, 50) + '...',
        htmlLength: emailData?.html?.length,
        tags: cleanTags
      });
      
      // If this is a validation error, don't retry with other providers
      if (error instanceof Error && (error.message.includes('validation') || error.message.includes('Invalid'))) {
        throw new Error(`Email validation failed: ${error.message}`);
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
    let emailResult;
    let deliveryStatus = 'PENDING';
    let deliveryError = null;
    
    try {
      emailResult = await sendEmail({
        to: options.clientEmail,
        subject,
        html,
        tags: ['client-approval', 'delivery', options.projectName.toLowerCase().replace(/\s+/g, '-')]
      });
      
      console.log('Email sent:', emailResult.messageId, 'via', emailResult.provider);
      deliveryStatus = 'SENT';
      
    } catch (emailError) {
      console.error('Email delivery failed:', emailError);
      deliveryStatus = 'FAILED';
      deliveryError = emailError instanceof Error ? emailError.message : 'Unknown error';
      
      // Update email log with failure status
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'FAILED',
          deliveryError,
          metadata: {
            error: deliveryError,
            failedAt: new Date().toISOString()
          }
        }
      });
      
      throw emailError; // Re-throw to maintain existing error handling
    }
    
    // Update email log with success status and provider info
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        deliveryStatus,
        providerId: emailResult.messageId,
        provider: emailResult.provider,
        metadata: {
          messageId: emailResult.messageId,
          provider: emailResult.provider,
          sentAt: new Date().toISOString()
        }
      }
    });

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
