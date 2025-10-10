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
export async function sendEmail(options: { to: string; subject: string; html: string; from?: string; tags?: string[]; attachments?: Array<{filename: string; content: string}> }) {
  // Get from address with multiple fallbacks
  let fromAddress = options.from || process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  
  // Use your business email for better deliverability (but fallback to verified domain)
  // TODO: Verify meisnerinteriors.com domain in Resend dashboard
  fromAddress = 'noreply@resend.dev'; // Using Resend default domain temporarily
  
  // If still no from address, provide a sensible default that should work with Resend
  // if (!fromAddress || fromAddress.trim() === '') {
  //   fromAddress = 'noreply@resend.dev'; // Resend's default domain for testing
  //   console.warn('\u26a0\ufe0f No EMAIL_FROM configured, using Resend default domain');
  // }
  
  
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
    
    
    // Build email data - be very strict about what we send to Resend
    const trimmedFrom = fromAddress.trim();
    const trimmedTo = options.to.trim();
    const trimmedSubject = options.subject.trim();
    
    // Validate email addresses format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedFrom)) {
      throw new Error(`Invalid FROM email address format: ${trimmedFrom}`);
    }
    if (!emailRegex.test(trimmedTo)) {
      throw new Error(`Invalid TO email address format: ${trimmedTo}`);
    }
    
    const emailData: Record<string, any> = {
      from: trimmedFrom,
      to: trimmedTo,
      subject: trimmedSubject,
      html: options.html,
      // Add reply-to for better deliverability (once domain is verified, can use meisnerinteriors.com)
      // reply_to: 'projects@meisnerinteriors.com'  // TODO: Enable once domain is verified
    };
    
    // Add attachments if provided
    if (options.attachments && options.attachments.length > 0) {
      emailData.attachments = options.attachments;
    }
    
    // TAGS CAUSE 422 VALIDATION ERROR - PERMANENTLY DISABLED
    // Note: Do not add emailData.tags = cleanTags; - it causes validation errors
    
    
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
    
    // Check for potential HTML issues that might cause "Invalid literal value" error
    const problematicPatterns = [
      { pattern: /alt=""/g, name: 'empty alt attributes' },
      { pattern: /src=""/g, name: 'empty src attributes' },
      { pattern: /href=""/g, name: 'empty href attributes' },
      { pattern: /title=""/g, name: 'empty title attributes' },
      { pattern: /class=""/g, name: 'empty class attributes' },
      { pattern: /id=""/g, name: 'empty id attributes' },
      { pattern: /style=""/g, name: 'empty style attributes' }
    ];
    
    const foundIssues = [];
    for (const { pattern, name } of problematicPatterns) {
      if (pattern.test(emailData.html)) {
        foundIssues.push(name);
      }
    }
    
    if (foundIssues.length > 0) {
      // Clean up empty attributes
      emailData.html = emailData.html
        .replace(/alt=""/g, 'alt="Image"')
        .replace(/src=""/g, '') // Remove empty src entirely
        .replace(/href=""/g, 'href="#"')
        .replace(/title=""/g, '') // Remove empty title entirely
        .replace(/class=""/g, '') // Remove empty class entirely
        .replace(/id=""/g, '') // Remove empty id entirely
        .replace(/style=""/g, ''); // Remove empty style entirely
    }
    
    
    if (validationErrors.length > 0) {
      throw new Error(`Email validation failed: ${validationErrors.join(', ')}`);
    }
    
    
    
    const result = await resend.emails.send(emailData);
    
    return { messageId: result.data?.id || 'resend-' + Date.now(), provider: 'resend' };
    
  } catch (error) {
    console.error('Resend send failed:', error);
    
    // Check for specific Resend validation errors
    if (error instanceof Error) {
      if (error.message.includes('validation_error') || error.message.includes('Invalid literal value')) {
        throw new Error(`Resend validation error: ${error.message}`);
      }
      
      if (error.message.includes('domain') || error.message.includes('verify') || error.message.includes('unauthorized')) {
        throw new Error(`Domain verification error: ${error.message}. Your domain might not be verified with Resend.`);
      }
    }
    
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
    
    // Validate required options with detailed error messages
    const validationErrors = [];
    if (!options.versionId || options.versionId.trim() === '') {
      validationErrors.push('versionId is required');
    }
    if (!options.clientEmail || options.clientEmail.trim() === '') {
      validationErrors.push('clientEmail is required');
    }
    if (!options.clientName || options.clientName.trim() === '') {
      validationErrors.push('clientName is required');
    }
    if (!options.projectName || options.projectName.trim() === '') {
      validationErrors.push('projectName is required');
    }
    if (!Array.isArray(options.assets)) {
      validationErrors.push('assets must be an array');
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }
    
    
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
    
    
    // Generate email template with enhanced data - be extra careful with undefined values
    const templateData = {
      clientName: options.clientName || 'Valued Client',
      projectName: options.projectName || 'Your Project',
      approvalUrl: placeholderApprovalUrl, // Placeholder URL for template compatibility
      assets: options.assets || [],
      trackingPixelUrl,
      roomName: versionDetails?.stage?.room?.name || versionDetails?.stage?.room?.type || 'Room',
      designPhase: 'Design Showcase'
    };
    
    // Only add projectAddress if it exists and is not empty (avoid undefined/empty strings)
    const projectAddress = versionDetails?.stage?.room?.project?.address;
    if (projectAddress && projectAddress.trim() !== '') {
      templateData.projectAddress = projectAddress;
    }
    
    
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
        let projectTag = options.projectName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-_]/g, '-')
          .replace(/-{2,}/g, '-') // Replace multiple hyphens with single
          .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens AFTER other replacements
        
        // Additional cleanup - trim any remaining edge cases
        projectTag = projectTag.trim();
        if (projectTag.endsWith('-')) {
          projectTag = projectTag.slice(0, -1);
        }
        if (projectTag.startsWith('-')) {
          projectTag = projectTag.slice(1);
        }
        
        // Limit length and final validation
        projectTag = projectTag.substring(0, 50);
        
        
        if (projectTag && projectTag.length > 0) {
          safeTags.push(projectTag);
        }
      }
      
      
      emailResult = await sendEmail({
        to: options.clientEmail,
        subject,
        html,
        tags: safeTags
      });
      
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
    console.error('Failed to send client approval email:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
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

  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    throw error;
  }
}
