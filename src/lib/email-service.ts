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
  console.log('\ud83d\udce7 Using Resend default domain (meisnerinteriors.com not verified yet)');
  
  // If still no from address, provide a sensible default that should work with Resend
  // if (!fromAddress || fromAddress.trim() === '') {
  //   fromAddress = 'noreply@resend.dev'; // Resend's default domain for testing
  //   console.warn('\u26a0\ufe0f No EMAIL_FROM configured, using Resend default domain');
  // }
  
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
      console.log('\ud83d\udcc4 Adding', options.attachments.length, 'attachments to email');
      emailData.attachments = options.attachments;
    }
    
    // TAGS CAUSE 422 VALIDATION ERROR - PERMANENTLY DISABLED
    console.log('🚫 Tags disabled - they cause Resend 422 validation errors');
    // Note: Do not add emailData.tags = cleanTags; - it causes validation errors
    
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
      console.warn('\u26a0\ufe0f HTML contains empty attributes that might cause Resend validation errors:', foundIssues);
      
      // Clean up empty attributes
      emailData.html = emailData.html
        .replace(/alt=""/g, 'alt="Image"')
        .replace(/src=""/g, '') // Remove empty src entirely
        .replace(/href=""/g, 'href="#"')
        .replace(/title=""/g, '') // Remove empty title entirely
        .replace(/class=""/g, '') // Remove empty class entirely
        .replace(/id=""/g, '') // Remove empty id entirely
        .replace(/style=""/g, ''); // Remove empty style entirely
        
      console.log('\ud83e\uddf9 Cleaned up empty HTML attributes:', foundIssues);
    }
    
    // Also check for any remaining empty quotes that might be problematic
    const emptyQuoteMatches = emailData.html.match(/=""/g);
    if (emptyQuoteMatches) {
      console.warn('\ud83d\udd0e Found', emptyQuoteMatches.length, 'empty quote patterns in HTML');
      console.log('Sample empty quotes:', emptyQuoteMatches.slice(0, 5));
    }
    
    if (validationErrors.length > 0) {
      console.error('❌ Email validation errors:', validationErrors);
      throw new Error(`Email validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Log exact JSON payload
    console.log('📋 EXACT JSON PAYLOAD:', JSON.stringify(emailData, null, 2));
    
    // Check ALL fields in emailData for empty strings
    console.log('🔍 FINAL EMAIL DATA INSPECTION:', {
      from: { value: emailData.from, isEmpty: emailData.from === '', length: emailData.from?.length },
      to: { value: emailData.to, isEmpty: emailData.to === '', length: emailData.to?.length },
      subject: { value: emailData.subject, isEmpty: emailData.subject === '', length: emailData.subject?.length },
      htmlLength: emailData.html.length,
      tags: emailData.tags,
      allKeys: Object.keys(emailData),
      emptyStringFields: Object.entries(emailData).filter(([key, value]) => value === '').map(([key]) => key)
    });
    
    console.log('📧 Using proper email template');
    console.log('📧 Final email data:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      htmlLength: emailData.html.length,
      hasUndefinedValues: Object.values(emailData).some(v => v === undefined),
      hasEmptyStrings: Object.values(emailData).some(v => v === ''),
      allKeys: Object.keys(emailData)
    });
    
    console.log('\ud83d\udce7 About to send email via Resend API');
    
    const result = await resend.emails.send(emailData);
    console.log('\u2705 Email sent successfully via Resend:', {
      messageId: result.data?.id,
      recipientEmail: emailData.to,
      subject: emailData.subject,
      fromEmail: emailData.from,
      fullResult: result
    });
    
    console.log('\ud83d\udce7 EMAIL DELIVERY STATUS:', {
      success: !!result.data?.id,
      messageId: result.data?.id,
      error: result.error,
      sentTo: emailData.to,
      sentFrom: emailData.from
    });
    
    return { messageId: result.data?.id || 'resend-' + Date.now(), provider: 'resend' };
    
  } catch (error) {
    console.error('❌ Resend send failed:', error);
    
    // Log the raw error object to understand its structure
    console.error('🔍 RAW ERROR OBJECT:', {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorKeys: error ? Object.keys(error) : [],
      errorMessage: error?.message,
      errorString: String(error)
    });
    
    // Check if it's a Resend API error with response data
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('📊 RESEND API RESPONSE ERROR:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      // Log the exact validation errors from Resend
      if (error.response?.data) {
        console.error('🚨 RESEND VALIDATION DETAILS:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Check if it's a 422 validation error specifically
    if (error?.response?.status === 422) {
      console.error('🚫 422 VALIDATION ERROR - Email data that was rejected:');
      console.error('📧 Subject:', JSON.stringify(emailData.subject));
      console.error('📧 From:', JSON.stringify(emailData.from));
      console.error('📧 To:', JSON.stringify(emailData.to));
      console.error('📧 HTML length:', emailData.html?.length);
      console.error('📧 HTML preview:', emailData.html?.substring(0, 200) + '...');
      console.error('📧 Tags:', JSON.stringify(emailData.tags));
      
      // Check for common validation issues
      const validationIssues = [];
      if (!emailData.subject) validationIssues.push('Missing subject');
      if (!emailData.from) validationIssues.push('Missing from');
      if (!emailData.to) validationIssues.push('Missing to');
      if (!emailData.html) validationIssues.push('Missing html');
      if (emailData.subject === '') validationIssues.push('Empty subject');
      if (emailData.from === '') validationIssues.push('Empty from');
      if (emailData.to === '') validationIssues.push('Empty to');
      if (emailData.html === '') validationIssues.push('Empty html');
      
      console.error('🔍 Potential validation issues:', validationIssues);
    }
    
    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Check for specific Resend validation errors
      if (error.message.includes('validation_error') || error.message.includes('Invalid literal value')) {
        console.error('\u26a0\ufe0f RESEND VALIDATION ERROR - This usually means an empty string was sent in a required field');
        console.error('Email data that caused the error:', JSON.stringify(emailData, null, 2));
        throw new Error(`Resend validation error: ${error.message}. Check console for email data details.`);
      }
      
      // Check for domain verification errors
      if (error.message.includes('domain') || error.message.includes('verify') || error.message.includes('unauthorized')) {
        console.error('\u26a0\ufe0f DOMAIN VERIFICATION ERROR - The FROM domain might not be verified with Resend');
        console.error('From address causing issue:', emailData.from);
        console.error('Try using noreply@resend.dev or verify your domain in Resend dashboard');
        throw new Error(`Domain verification error: ${error.message}. Your domain might not be verified with Resend.`);
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
    console.log('🚀 CLIENT APPROVAL EMAIL - Starting process with options:', {
      versionId: options.versionId,
      clientEmail: options.clientEmail,
      clientName: options.clientName,
      projectName: options.projectName,
      assetsCount: options.assets?.length || 0,
      assets: options.assets
    });
    
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
      console.error('❌ CLIENT APPROVAL EMAIL - Validation failed:', validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
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
    
    console.log('\ud83c\udfaf TRACKING SETUP:', {
      emailLogId: emailLog.id,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      fullTrackingUrl: trackingPixelUrl
    });

    // Generate a placeholder approval URL for template compatibility
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const placeholderApprovalUrl = `${baseUrl}/client-progress/placeholder`;
    
    console.log('📧 Generating email template with data:', {
      clientName: options.clientName,
      projectName: options.projectName,
      roomName: versionDetails?.stage?.room?.name || versionDetails?.stage?.room?.type,
      assetCount: options.assets.length
    });
    
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
    
    console.log('📝 CLIENT APPROVAL TEMPLATE DATA - Detailed inspection:', {
      clientName: {
        value: templateData.clientName,
        type: typeof templateData.clientName,
        length: templateData.clientName?.length,
        isEmpty: templateData.clientName === ''
      },
      projectName: {
        value: templateData.projectName,
        type: typeof templateData.projectName,
        length: templateData.projectName?.length,
        isEmpty: templateData.projectName === ''
      },
      roomName: {
        value: templateData.roomName,
        type: typeof templateData.roomName,
        length: templateData.roomName?.length,
        isEmpty: templateData.roomName === ''
      },
      approvalUrl: {
        value: templateData.approvalUrl,
        type: typeof templateData.approvalUrl,
        length: templateData.approvalUrl?.length,
        isEmpty: templateData.approvalUrl === ''
      },
      trackingPixelUrl: {
        value: templateData.trackingPixelUrl,
        type: typeof templateData.trackingPixelUrl,
        length: templateData.trackingPixelUrl?.length,
        isEmpty: templateData.trackingPixelUrl === ''
      },
      designPhase: {
        value: templateData.designPhase,
        type: typeof templateData.designPhase,
        length: templateData.designPhase?.length,
        isEmpty: templateData.designPhase === ''
      },
      assetsCount: templateData.assets.length,
      hasProjectAddress: !!projectAddress,
      projectAddress: projectAddress
    });
    
    console.log('🎨 About to generate email template with:', JSON.stringify(templateData, null, 2));
    
    const { subject, html } = generateMeisnerDeliveryEmailTemplate(templateData);
    console.log('\u2728 EMAIL TEMPLATE GENERATED:', {
      subjectLength: subject?.length || 0,
      htmlLength: html?.length || 0,
      subjectPreview: subject?.substring(0, 100),
      subjectIsEmpty: subject === '',
      htmlIsEmpty: html === '',
      trackingUrlInHtml: html.includes('api/email/track'),
      trackingUrlFound: html.match(/api\/email\/track\/[\w-]+/)?.[0] || 'Not found',
      logoUrlInHtml: html.includes('meisnerinteriorlogo.png'),
      logoUrlFound: html.match(/http[s]?:\/\/[^\s]+meisnerinteriorlogo\.png/)?.[0] || 'Logo URL not found'
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
        
        console.log('🏷️ Tag processing:', {
          original: options.projectName,
          processed: projectTag,
          isValid: projectTag.length > 0 && !projectTag.includes('--') && !projectTag.endsWith('-')
        });
        
        if (projectTag && projectTag.length > 0) {
          safeTags.push(projectTag);
        }
      }
      
      // Assets are now embedded as download buttons in the email template
      console.log('\ud83c\udf86 ASSETS EMBEDDED AS DOWNLOAD BUTTONS:', {
        assetsCount: options.assets.length,
        assets: options.assets.map(a => ({ id: a.id, url: a.url, includeInEmail: a.includeInEmail }))
      });
      
      console.log('\ud83d\udce9 CLIENT APPROVAL EMAIL - About to call sendEmail with:', {
        to: options.clientEmail,
        subject: subject?.substring(0, 50) + '...',
        subjectLength: subject?.length || 0,
        htmlLength: html?.length || 0,
        tags: safeTags,
        subjectIsEmpty: subject === '',
        htmlIsEmpty: html === '',
        toIsEmpty: options.clientEmail === ''
      });
      
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
