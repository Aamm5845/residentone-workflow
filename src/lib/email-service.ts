import { Resend } from 'resend';
import { generateClientApprovalToken } from './jwt';
import { generateMeisnerDeliveryEmailTemplate, generateFollowUpEmailTemplate, generateConfirmationEmailTemplate } from './email-templates';
import { prisma } from './prisma';

// Initialize Resend
if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required');
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Email sending function using Resend only
async function sendEmail(options: { to: string; subject: string; html: string; from?: string; tags?: string[] }) {
  // Get from address with multiple fallbacks
  let fromAddress = options.from || process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  
  // If still no from address, provide a sensible default that should work with Resend
  if (!fromAddress || fromAddress.trim() === '') {
    fromAddress = 'noreply@resend.dev'; // Resend's default domain for testing
    console.warn('⚠️ No EMAIL_FROM configured, using Resend default domain');
  }
  
  console.log('📧 Attempting to send email via Resend:', {
    to: options.to,
    subject: options.subject,
    from: fromAddress
  });
  
  // Validate required fields
  if (!fromAddress || fromAddress.trim() === '') {
    throw new Error('FROM address is required. Please set EMAIL_FROM environment variable.');
  }
  if (!options.to || options.to.trim() === '') {
    throw new Error('Recipient email address is required');
  }
  if (!options.subject || options.subject.trim() === '') {
    throw new Error('Email subject is required');
  }
  if (!options.html || options.html.trim() === '') {
    throw new Error('Email content is required');
  }
  
  try {
    // Clean and validate tags - be extra careful with undefined/null/empty values
    const cleanTags = options.tags
      ?.filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
      ?.map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'))
      ?.filter(tag => tag.length > 0) // Remove any empty strings after cleaning
      ?.slice(0, 10) || [];
    
    // Enhanced debugging: Log raw input data
    console.log('🔍 RAW EMAIL INPUT DATA:', {
      from: {
        value: fromAddress,
        type: typeof fromAddress,
        length: fromAddress?.length,
        isNull: fromAddress === null,
        isUndefined: fromAddress === undefined,
        isEmpty: fromAddress === ''
      },
      to: {
        value: options.to,
        type: typeof options.to,
        length: options.to?.length,
        isNull: options.to === null,
        isUndefined: options.to === undefined,
        isEmpty: options.to === ''
      },
      subject: {
        value: options.subject,
        type: typeof options.subject,
        length: options.subject?.length,
        isNull: options.subject === null,
        isUndefined: options.subject === undefined,
        isEmpty: options.subject === '',
        preview: options.subject?.substring(0, 50)
      },
      html: {
        type: typeof options.html,
        length: options.html?.length,
        isNull: options.html === null,
        isUndefined: options.html === undefined,
        isEmpty: options.html === '',
        preview: options.html?.substring(0, 100)
      },
      rawTags: {
        value: options.tags,
        type: typeof options.tags,
        isArray: Array.isArray(options.tags),
        length: options.tags?.length,
        cleanedLength: cleanTags.length
      }
    });
    
    // Build email data - be very strict about what we send to Resend
    const emailData: Record<string, any> = {
      from: fromAddress.trim(),
      to: options.to.trim(),
      subject: options.subject.trim(),
      html: options.html
    };
    
    // Only add tags if we have valid ones - Resend doesn't like empty arrays or undefined
    if (cleanTags.length > 0) {
      emailData.tags = cleanTags;
    }
    // Don't add tags field at all if empty - this might be causing the validation error
    
    // Enhanced debugging: Log processed email data
    console.log('📤 PROCESSED EMAIL DATA FOR RESEND:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject.substring(0, 50) + (emailData.subject.length > 50 ? '...' : ''),
      htmlLength: emailData.html.length,
      tags: cleanTags,
      hasUndefinedFields: Object.entries(emailData).some(([key, value]) => value === undefined),
      hasNullFields: Object.entries(emailData).some(([key, value]) => value === null),
      hasEmptyStringFields: Object.entries(emailData).some(([key, value]) => value === '')
    });
    
    // Final validation before sending to Resend - check for problematic values
    const validationErrors = [];
    
    // Check for empty strings (Resend doesn't like them)
    if (emailData.from === '') validationErrors.push('from field is empty string');
    if (emailData.to === '') validationErrors.push('to field is empty string');
    if (emailData.subject === '') validationErrors.push('subject field is empty string');
    if (emailData.html === '') validationErrors.push('html field is empty string');
    
    // Check for undefined values
    if (emailData.from === undefined) validationErrors.push('from field is undefined');
    if (emailData.to === undefined) validationErrors.push('to field is undefined');
    if (emailData.subject === undefined) validationErrors.push('subject field is undefined');
    if (emailData.html === undefined) validationErrors.push('html field is undefined');
    
    // Check tags array if present
    if (emailData.tags && (!Array.isArray(emailData.tags) || emailData.tags.some(tag => !tag || tag.trim() === ''))) {
      validationErrors.push('tags array contains invalid values');
    }
    
    if (validationErrors.length > 0) {
      console.error('❌ Email validation errors:', validationErrors);
      throw new Error(`Email validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Log exact JSON payload
    console.log('📋 EXACT JSON PAYLOAD:', JSON.stringify(emailData, null, 2));
    
    const result = await resend.emails.send(emailData);
    console.log('✅ Email sent successfully:', result.data?.id);
    
    return { messageId: result.data?.id || 'resend-' + Date.now(), provider: 'resend' };
    
  } catch (error) {
    console.error('❌ Resend send failed:', error);
    
    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Check if this is the specific Resend validation error
      if (error.message.includes('validation_error') || error.message.includes('Invalid literal value')) {
        console.error('⚠️ RESEND VALIDATION ERROR - This usually means an empty string was sent in a required field');
        console.error('Email data that caused the error:', JSON.stringify(emailData, null, 2));
        throw new Error(`Resend validation error: ${error.message}. Check console for email data details.`);
      }
    }
    
    // Re-throw the error with more context
    throw new Error(`Failed to send email via Resend: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    // Validate required options
    if (!options.versionId || options.versionId.trim() === '') {
      throw new Error('versionId is required');
    }
    if (!options.clientEmail || options.clientEmail.trim() === '') {
      throw new Error('clientEmail is required');
    }
    if (!options.clientName || options.clientName.trim() === '') {
      throw new Error('clientName is required');
    }
    if (!options.projectName || options.projectName.trim() === '') {
      throw new Error('projectName is required');
    }
    if (!Array.isArray(options.assets)) {
      throw new Error('assets must be an array');
    }
    
    console.log('✅ Client approval email options validated:', {
      versionId: options.versionId,
      clientEmail: options.clientEmail,
      clientName: options.clientName,
      projectName: options.projectName,
      assetsCount: options.assets.length
    });
    
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
    const templateData = {
      clientName: options.clientName || 'Valued Client',
      projectName: options.projectName || 'Your Project',
      approvalUrl: placeholderApprovalUrl, // Placeholder URL for template compatibility
      assets: options.assets || [],
      trackingPixelUrl,
      roomName: versionDetails?.stage?.room?.name || versionDetails?.stage?.room?.type || 'Room',
      designPhase: 'Design Showcase'
    };
    
    // Only add projectAddress if it exists (avoid undefined)
    const projectAddress = versionDetails?.stage?.room?.project?.address;
    if (projectAddress) {
      templateData.projectAddress = projectAddress;
    }
    
    console.log('📝 Template data being passed:', {
      ...templateData,
      assetsCount: templateData.assets.length,
      hasProjectAddress: !!projectAddress
    });
    
    const { subject, html } = generateMeisnerDeliveryEmailTemplate(templateData);

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
      // Create safe tags (avoid undefined or problematic values)
      const safeTags = ['client-approval', 'delivery'];
      if (options.projectName && typeof options.projectName === 'string') {
        const projectTag = options.projectName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-_]/g, '-')
          .substring(0, 50); // Limit length
        if (projectTag) {
          safeTags.push(projectTag);
        }
      }
      
      emailResult = await sendEmail({
        to: options.clientEmail,
        subject,
        html,
        tags: safeTags
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
