interface RenderAsset {
  id: string;
  url: string;
  includeInEmail: boolean;
}

interface EmailTemplateData {
  clientName: string;
  projectName: string;
  approvalUrl: string;
  assets: RenderAsset[];
  trackingPixelUrl?: string;
}

export function generateMeisnerDeliveryEmailTemplate(data: EmailTemplateData & {
  roomName?: string;
  designPhase?: string;
  projectAddress?: string;
  emailLogId?: string; // For tracking downloads
}): { subject: string; html: string } {
  const emailedAssets = data.assets.filter(asset => asset.includeInEmail);
  
  const subject = `Your ${data.roomName || 'Design'} Renderings Are Ready | ${data.projectName}`;
  
  // Generate the first image preview and additional download links
  const filteredAssets = data.assets?.filter(asset => asset.includeInEmail) || [];
  const firstAsset = filteredAssets[0];
  const additionalAssets = filteredAssets.slice(1);
  
  // Ensure URLs work for downloading
  const getDownloadUrl = (url: string) => {
    // Dropbox: Convert raw=1 to dl=1 for download
    if (url.includes('dropbox.com') || url.includes('dl.dropboxusercontent.com')) {
      return url.replace('raw=1', 'dl=1')
    }
    // Vercel Blob URLs work as-is for download
    // The download attribute in the <a> tag will trigger download behavior
    return url
  }
  
  const firstImageHtml = firstAsset ? `
    <div style="text-align: center; margin: 24px 0;">
      <img src="${firstAsset.url}" 
           alt="Design Preview" 
           style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"/>
      <div style="margin-top: 12px;">
        <a href="${getDownloadUrl(firstAsset.url)}" 
           style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;"
           download
           target="_blank">Download High Resolution</a>
      </div>
    </div>` : '';
  
  const additionalAssetsHtml = additionalAssets.map((asset, index) => {
    const cleanFileName = `Design Rendering ${index + 2}`;
    return `
      <div style="border: 1px solid #e1e5e9; border-radius: 8px; padding: 16px; margin: 12px 0; background: #fafbfc;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 4px 0; color: #2c3e50; font-size: 14px; font-weight: 600;">${cleanFileName}</h4>
            <p style="margin: 0; color: #64748b; font-size: 12px;">High Resolution Image</p>
          </div>
          <a href="${getDownloadUrl(asset.url)}" 
             style="background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500; margin-left: 16px;"
             download
             target="_blank">Download</a>
        </div>
      </div>`;
  }).join('');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Design Delivery - Meisner Interiors</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 32px; text-align: center;">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://residentone-workflow.vercel.app'}/meisnerinteriorlogo.png"
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" 
                 draggable="false" 
                 ondragstart="return false;" 
                 oncontextmenu="return false;"/>
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Design Delivery</h1>
            <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 16px; font-weight: 400;">${data.roomName || 'Your Space'} • ${data.projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Dear ${data.clientName},</p>
            
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">We're excited to share the completed renderings for your <strong>${data.roomName || 'space'}</strong>. Every detail has been carefully crafted to bring your vision to life.</p>
            
            <!-- First Image Preview -->
            ${firstImageHtml}
            
            <!-- Additional Files Section -->
            ${additionalAssets.length > 0 ? `
            <div style="margin: 32px 0;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Additional Design Files</h3>
                ${additionalAssetsHtml}
            </div>` : ''}
            
            <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">Thank you for trusting us with your vision. We're here to answer any questions you may have about the design.</p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors</div>
            
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
            
            <!-- Tracking Pixel -->
            ${data.trackingPixelUrl ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />` : '<!-- No tracking URL provided -->'}
        </div>
    </div>
</body>
</html>`;

  return { subject, html };
}

// Keep the original function for backward compatibility
export function generateDeliveryEmailTemplate(data: EmailTemplateData): { subject: string; html: string } {
  return generateMeisnerDeliveryEmailTemplate(data);
}

// Project Update Notification Email Template
interface ProjectUpdateEmailData {
  recipientName: string
  projectName: string
  clientName: string
  updateTitle: string
  updateDescription?: string
  updateType: string
  photoCount: number
  authorName: string
  updateUrl: string
  photoUrls?: string[] // First 3-4 photo thumbnails
}

export function generateProjectUpdateNotificationEmail(data: ProjectUpdateEmailData): { subject: string; html: string } {
  const subject = `New Update: ${data.updateTitle} - ${data.projectName}`
  
  const photoPreviewHtml = data.photoUrls && data.photoUrls.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Photos (${data.photoCount})</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
        ${data.photoUrls.slice(0, 4).map(url => `
          <img src="${url}" 
               alt="Update photo" 
               style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;"/>
        `).join('')}
      </div>
      ${data.photoCount > 4 ? `<p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px; text-align: center;">+${data.photoCount - 4} more photos</p>` : ''}
    </div>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Update - ${data.projectName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 32px; text-align: center;">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://residentone-workflow.vercel.app'}/meisnerinteriorlogo.png"
                 alt="Meisner Interiors" 
                 style="max-width: 180px; height: auto; margin-bottom: 16px; background-color: white; padding: 12px; border-radius: 8px;"/>
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Project Update</h1>
            <p style="margin: 8px 0 0 0; color: #e9d5ff; font-size: 14px;">${data.projectName} • ${data.clientName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px;">
            <p style="margin: 0 0 20px 0; color: #1e293b; font-size: 15px;">Hi ${data.recipientName},</p>
            
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.7;">${data.authorName} posted a new <strong>${data.updateType.toLowerCase()}</strong> update on the project.</p>
            
            <!-- Update Card -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                  <h2 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">${data.updateTitle}</h2>
                  <span style="background: #ddd6fe; color: #6d28d9; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 500; text-transform: uppercase;">${data.updateType}</span>
                </div>
                
                ${data.updateDescription ? `
                <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px; line-height: 1.6;">${data.updateDescription}</p>
                ` : ''}
                
                ${photoPreviewHtml}
                
                <div style="margin-top: 20px; text-align: center;">
                  <a href="${data.updateUrl}" 
                     style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;">View Full Update</a>
                </div>
            </div>
            
            <p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px; line-height: 1.6;">You're receiving this because you're a team member on this project. Stay up to date with all project progress and updates.</p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors</div>
            
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #7c3aed; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #7c3aed; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}

export function generateFollowUpEmailTemplate(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Friendly Reminder: Design Approval Needed - ${data.projectName}`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 20px 0 10px 0;
        }
        .cta-button {
            display: inline-block;
            background: #059669;
            color: white !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        .cta-button:hover {
            background: #047857;
        }
        .footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        @media only screen and (max-width: 600px) {
            .container {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ResidentOne</div>
            <h1>Friendly Reminder</h1>
        </div>

        <div>
            <p>Hi ${data.clientName},</p>
            <p>We hope you're as excited as we are about the renderings we shared for <strong>${data.projectName}</strong>!</p>
            <p>We wanted to follow up to make sure you received our previous email with the design renderings. Your feedback is important to keep your project moving forward on schedule.</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
            <a href="${data.approvalUrl}" class="cta-button">Review & Approve Renderings</a>
        </div>

        <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #92400e;">⏰ Time Sensitive</h3>
            <p style="margin-bottom: 0;">To stay on track with your project timeline, we'd love to hear from you by the end of the week. If you have any questions or need to discuss the renderings, please don't hesitate to reach out.</p>
        </div>

        <div class="footer">
            <p>Questions? Reply to this email or contact us at <a href="mailto:support@residentone.com">support@residentone.com</a></p>
            <p style="margin-top: 20px; color: #9ca3af;">
                We're here to help ensure your project exceeds your expectations.
            </p>
            ${data.trackingPixelUrl ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:none;" />` : ''}
        </div>
    </div>
</body>
</html>`;

  return { subject, html };
}

export function generateConfirmationEmailTemplate(data: { clientName: string; projectName: string; decision: 'APPROVED' | 'REVISION_REQUESTED'; comments?: string }): { subject: string; html: string } {
  const isApproved = data.decision === 'APPROVED';
  const subject = isApproved 
    ? `Thank You! Renderings Approved - ${data.projectName}`
    : `Thank You for Your Feedback - ${data.projectName}`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        h1 {
            color: ${isApproved ? '#059669' : '#dc2626'};
            font-size: 24px;
            margin: 20px 0 10px 0;
        }
        .status-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .comments-box {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        @media only screen and (max-width: 600px) {
            .container {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ResidentOne</div>
            <div class="status-icon">${isApproved ? '✅' : '📝'}</div>
            <h1>${isApproved ? 'Renderings Approved!' : 'Feedback Received'}</h1>
        </div>

        <div>
            <p>Hi ${data.clientName},</p>
            ${isApproved ? `
                <p>Thank you for approving the renderings for <strong>${data.projectName}</strong>! We're thrilled that you're happy with the designs.</p>
                <p>Our team will now move forward with the next phase of your project. We'll keep you updated on our progress and reach out if we need any additional input from you.</p>
            ` : `
                <p>Thank you for your feedback on the renderings for <strong>${data.projectName}</strong>. We appreciate you taking the time to review the designs and provide your input.</p>
                <p>Our design team will carefully review your comments and work on the requested revisions. We'll have updated renderings ready for your review soon.</p>
            `}
        </div>

        ${data.comments ? `
            <div class="comments-box">
                <h3 style="margin-top: 0; color: #1e40af;">Your Comments:</h3>
                <p style="margin-bottom: 0; font-style: italic;">"${data.comments}"</p>
            </div>
        ` : ''}

        <div style="background: ${isApproved ? '#f0fdf4' : '#fef3c7'}; border: 1px solid ${isApproved ? '#22c55e' : '#f59e0b'}; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: ${isApproved ? '#15803d' : '#92400e'};">${isApproved ? '🎉' : '⚡'} What's Next?</h3>
            <p style="margin-bottom: 0;">
                ${isApproved 
                  ? "We'll begin working on the next phase of your project and will keep you informed of our progress every step of the way."
                  : "Our team will incorporate your feedback and have revised renderings ready for your review within 3-5 business days."
                }
            </p>
        </div>

        <div class="footer">
            <p>Questions? Reply to this email or contact us at <a href="mailto:support@residentone.com">support@residentone.com</a></p>
            <p style="margin-top: 20px; color: #9ca3af;">
                Thank you for choosing ResidentOne. We're excited to bring your vision to life!
            </p>
        </div>
    </div>
</body>
</html>`;

  return { subject, html };
}
