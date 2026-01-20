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

// Supplier Quote Request Email Template
export interface SupplierQuoteEmailData {
  rfqNumber?: string
  projectName: string
  projectAddress?: string | null
  clientName: string
  supplierName: string
  items: Array<{
    name: string
    description?: string | null
    brand?: string | null
    sku?: string | null
    color?: string | null
    finish?: string | null
    material?: string | null
    quantity?: number | null
    unitType?: string | null
    images?: string[] | null
    section?: { name?: string; instance?: { room?: { name?: string } } } | null
  }>
  portalUrl: string
  message?: string
  deadline: Date
  includeSpecSheet?: boolean
  includeNotes?: boolean
  isPreview?: boolean
}

export function generateSupplierQuoteEmailTemplate(data: SupplierQuoteEmailData): string {
  const itemRows = data.items.map(item => {
    const imageUrl = item.images?.[0]
    const specs = [
      item.brand && `Brand: ${item.brand}`,
      item.sku && `SKU: ${item.sku}`,
      item.color && `Color: ${item.color}`,
      item.finish && `Finish: ${item.finish}`,
      item.material && `Material: ${item.material}`,
    ].filter(Boolean).join(' | ')

    // Show notes under item - in preview mode, always show notes so user can decide
    // In actual email, only show if includeNotes is enabled
    let notesHtml = ''
    if (item.notes) {
      if (data.isPreview) {
        // In preview, always show notes but indicate if they will be included
        if (data.includeNotes) {
          notesHtml = `<div style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; margin-top: 8px; border-radius: 0 4px 4px 0;">
            <span style="color: #92400e; font-size: 12px;"><strong>Note:</strong> ${item.notes}</span>
          </div>`
        } else {
          notesHtml = `<div style="background: #fee2e2; border-left: 3px solid #ef4444; padding: 8px 12px; margin-top: 8px; border-radius: 0 4px 4px 0; opacity: 0.7;">
            <span style="color: #b91c1c; font-size: 12px;"><strong>Note (NOT included):</strong> ${item.notes}</span>
          </div>`
        }
      } else if (data.includeNotes) {
        // Actual email - only show if includeNotes is enabled
        notesHtml = `<div style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; margin-top: 8px; border-radius: 0 4px 4px 0;">
          <span style="color: #92400e; font-size: 12px;"><strong>Note:</strong> ${item.notes}</span>
        </div>`
      }
    }

    return `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; width: 80px;">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${item.name}" width="70" height="70" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />`
            : `<div style="width: 70px; height: 70px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 24px;">📦</div>`
          }
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <div style="font-weight: 600; color: #111827; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
          ${item.description ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 6px;">${item.description}</div>` : ''}
          ${specs ? `<div style="color: #9ca3af; font-size: 12px;">${specs}</div>` : ''}
          ${item.section?.instance?.room?.name ? `<div style="color: #9ca3af; font-size: 11px; margin-top: 4px;">📍 ${item.section.instance.room.name} - ${item.section.name}</div>` : ''}
          ${notesHtml}
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; text-align: center; width: 100px;">
          <div style="font-weight: 600; color: #111827; font-size: 16px;">${item.quantity || 1}</div>
          <div style="color: #6b7280; font-size: 12px;">${item.unitType || 'units'}</div>
        </td>
      </tr>
    `
  }).join('')

  const previewBanner = data.isPreview ? `
  <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
    <strong style="color: #92400e;">📧 Email Preview</strong>
    <span style="color: #92400e;"> - This is exactly what the supplier will receive. Click the button to test the portal.</span>
  </div>
  ` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Request from Meisner Interiors</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">

  ${previewBanner}

  <!-- Header with Meisner Branding -->
  <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Meisner Interiors</p>
    <h1 style="color: white; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">Quote Request</h1>
    <p style="color: #d1d5db; margin: 0; font-size: 14px;">${data.projectName}</p>
  </div>

  <!-- Content -->
  <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">

    <!-- Greeting -->
    <p style="margin: 0 0 20px 0; font-size: 15px;">
      Dear ${data.supplierName},
    </p>

    <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563;">
      <strong>Meisner Interiors</strong> is requesting a quote for the following items for our project. Please review the details below and submit your pricing through our secure portal.
    </p>

    ${data.message ? `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 24px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Note:</strong> ${data.message}</p>
    </div>
    ` : ''}

    <!-- Project Info -->
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px; width: 120px;">Project:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 500;">${data.projectName}</td>
        </tr>
        ${data.projectAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Address:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px;">${data.projectAddress}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Client:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px;">${data.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Items:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 500;">${data.items.length} item${data.items.length > 1 ? 's' : ''}</td>
        </tr>
      </table>
    </div>

    <!-- Items Table -->
    <h3 style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Items Requested</h3>

    <table style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;"></th>
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Item Details</th>
          <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    ${data.includeSpecSheet ? `
    <!-- Spec Sheet Note -->
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0; color: #0369a1; font-size: 14px;">
        <strong>📋 Spec sheets & documents available</strong><br>
        <span style="font-size: 13px; color: #0284c7;">Full specifications and product documents are available in the portal for your review.</span>
      </p>
    </div>
    ` : ''}


    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.portalUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        Submit Your Quote
      </a>
    </div>

    <p style="text-align: center; color: #9ca3af; font-size: 11px; margin: 0 0 16px 0;">
      Please respond by ${data.deadline.toLocaleDateString()}
    </p>

    <!-- Direct Link -->
    <div style="background: #f0fdf4; border-radius: 6px; padding: 12px; text-align: center;">
      <strong style="font-size: 12px; color: #166534;">Direct link:</strong><br/>
      <a href="${data.portalUrl}" target="_blank" style="color: #059669; font-size: 11px; word-break: break-all;">${data.portalUrl}</a>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding: 24px; text-align: center; border-radius: 0 0 12px 12px; background: #f9fafb;">
    <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">
      Meisner Interiors
    </p>
    <p style="color: #6b7280; font-size: 13px; margin: 0 0 12px 0;">
      Questions? Reply to this email or contact us directly.
    </p>
    <p style="color: #9ca3af; font-size: 11px; margin: 0;">
      www.meisnerinteriors.com | Powered by StudioFlow
    </p>
  </div>

</body>
</html>`
}

// Client Quote Email Template
interface ClientQuoteEmailData {
  quoteNumber: string
  clientName: string
  clientAddress?: string // Client/project address
  projectName: string
  title?: string // Invoice title
  companyName: string
  companyLogo?: string
  companyPhone?: string
  companyEmail?: string
  quoteUrl: string
  validUntil?: Date
  lineItems: Array<{
    name: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  gstRate: number
  gstAmount: number
  qstRate: number
  qstAmount: number
  total: number
  currency?: string // CAD or USD
  note?: string
  trackingPixelUrl?: string
}

export function generateClientQuoteEmailTemplate(data: ClientQuoteEmailData): {
  subject: string
  html: string
} {
  const subject = `Invoice ${data.quoteNumber} from ${data.companyName}`
  const invoiceCurrency = data.currency || 'CAD'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: invoiceCurrency,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const trackingPixelHtml = data.trackingPixelUrl
    ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${data.quoteNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
    <div style="max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="padding: 40px 40px 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            ${data.companyLogo ? `
            <img src="${data.companyLogo}"
                 alt="${data.companyName}"
                 style="max-width: 220px; max-height: 80px; height: auto; margin-bottom: 24px;" />
            ` : `
            <div style="color: #111827; font-size: 22px; font-weight: 700; margin-bottom: 24px;">${data.companyName}</div>
            `}
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">Invoice ${data.quoteNumber}</p>
            ${data.title ? `<p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">${data.title}</p>` : ''}
        </div>

        <!-- Bill To Section -->
        <div style="padding: 20px 40px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Bill To</p>
            <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 500;">${data.clientName}</p>
            ${data.clientAddress ? `<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${data.clientAddress}</p>` : ''}
        </div>

        <!-- Content -->
        <div style="padding: 32px 40px;">
            <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 15px;">
                Here's your invoice for <strong>${data.projectName}</strong>. Please review the details and submit payment at your earliest convenience.
            </p>

            <!-- Amount Due Box -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Amount Due</p>
                <p style="margin: 0; color: #111827; font-size: 32px; font-weight: 700;">${formatCurrency(data.total)}</p>
                ${data.validUntil ? `
                <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 13px;">Due by ${formatDate(data.validUntil)}</p>
                ` : ''}
            </div>

            ${data.note ? `
            <div style="background: #fefce8; border-left: 3px solid #eab308; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; color: #713f12; font-size: 14px;">${data.note}</p>
            </div>
            ` : ''}

            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 32px;">
                <a href="${data.quoteUrl}"
                   style="display: inline-block; background: #111827; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                    View Invoice
                </a>
            </div>

            <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Click the button above to view the full invoice details and payment options.
            </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
            <p style="margin: 0 0 4px 0; color: #374151; font-size: 14px; font-weight: 500;">${data.companyName}</p>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">${data.companyEmail || 'shaya@meisnerinteriors.com'}</p>
            ${data.companyPhone ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${data.companyPhone}</p>` : ''}
        </div>
    </div>

    <!-- Bottom note -->
    <div style="max-width: 560px; margin: 16px auto 40px auto; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${data.companyName}. All rights reserved.
        </p>
    </div>
    ${trackingPixelHtml}
</body>
</html>`

  return { subject, html }
}

/**
 * Payment confirmation email template
 */
export interface PaymentConfirmationEmailData {
  clientName: string
  clientEmail: string
  projectName: string
  invoiceNumber: string
  paymentAmount: number
  paymentMethod: string
  totalAmount: number
  paidToDate: number
  remainingBalance: number
  isFullyPaid: boolean
  paidAt: Date
  companyName: string
  companyEmail?: string
  companyPhone?: string
  companyLogo?: string
}

export function generatePaymentConfirmationEmailTemplate(data: PaymentConfirmationEmailData): {
  subject: string
  html: string
} {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  const formatPaymentMethod = (method: string) => {
    const methodMap: Record<string, string> = {
      'CREDIT_CARD': 'Credit Card',
      'WIRE_TRANSFER': 'Wire Transfer',
      'CHECK': 'Check',
      'ACH_BANK_TRANSFER': 'ACH Bank Transfer',
      'CASH': 'Cash',
      'E_TRANSFER': 'Interac e-Transfer',
      'OTHER': 'Other'
    }
    return methodMap[method] || method.replace(/_/g, ' ')
  }

  const subject = data.isFullyPaid
    ? `Payment Received - Invoice ${data.invoiceNumber} Paid in Full`
    : `Payment Received - Invoice ${data.invoiceNumber}`

  const statusBadgeHtml = data.isFullyPaid
    ? `<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">PAID IN FULL</span>`
    : `<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">PARTIAL PAYMENT</span>`

  const balanceHtml = !data.isFullyPaid ? `
    <tr>
      <td style="padding: 12px 16px; color: #6b7280;">Remaining Balance</td>
      <td style="padding: 12px 16px; text-align: right; color: #ef4444; font-weight: 600;">${formatCurrency(data.remainingBalance)}</td>
    </tr>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px; text-align: center;">
            ${data.companyLogo ? `
            <img src="${data.companyLogo}"
                 alt="${data.companyName}"
                 style="max-width: 180px; max-height: 60px; height: auto; margin-bottom: 16px; background-color: white; padding: 12px; border-radius: 6px;" />
            ` : `
            <div style="color: white; font-size: 24px; font-weight: 700; margin-bottom: 16px;">${data.companyName}</div>
            `}
            <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px auto;">
              <span style="font-size: 32px; line-height: 64px; color: white;">✓</span>
            </div>
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Payment Received</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Thank you for your payment</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            <p style="margin: 0 0 24px 0; color: #1f2937; font-size: 16px;">Dear ${data.clientName},</p>

            <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px;">
                We have received your payment for Invoice <strong>${data.invoiceNumber}</strong>. Thank you for your prompt payment.
            </p>

            <!-- Payment Details Card -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <div style="margin-bottom: 16px;">
                    <span style="color: #1f2937; font-size: 16px; font-weight: 600;">Payment Details</span>
                    <span style="float: right;">${statusBadgeHtml}</span>
                </div>

                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Invoice Number</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937; font-weight: 500;">${data.invoiceNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Project</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${data.projectName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Payment Date</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${formatDate(data.paidAt)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Payment Method</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${formatPaymentMethod(data.paymentMethod)}</td>
                    </tr>
                    <tr style="background: #ecfdf5;">
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #065f46; font-weight: 600;">Amount Paid</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #065f46; font-weight: 700; font-size: 18px;">${formatCurrency(data.paymentAmount)}</td>
                    </tr>
                </table>
            </div>

            <!-- Invoice Summary -->
            <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: 600;">Invoice Summary</h3>

                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Invoice Total</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${formatCurrency(data.totalAmount)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total Paid to Date</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #10b981; font-weight: 600;">${formatCurrency(data.paidToDate)}</td>
                    </tr>
                    ${balanceHtml}
                </table>
            </div>

            ${data.isFullyPaid ? `
            <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; color: #065f46; font-size: 15px;">
                    <strong>Your invoice has been paid in full.</strong><br/>
                    Thank you for your business!
                </p>
            </div>
            ` : `
            <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; color: #92400e; font-size: 15px;">
                    <strong>Remaining balance: ${formatCurrency(data.remainingBalance)}</strong><br/>
                    Please remit the remaining amount at your earliest convenience.
                </p>
            </div>
            `}

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

            <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                Questions? Contact us at ${data.companyEmail || 'info@company.com'}
                ${data.companyPhone ? ` or ${data.companyPhone}` : ''}
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
            <div style="color: #374151; font-size: 14px; font-weight: 600; margin-bottom: 8px;">${data.companyName}</div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} All rights reserved.</p>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}

/**
 * Purchase Order Email Template
 * Professional email sent to suppliers when placing an order
 */
export interface PurchaseOrderEmailData {
  poNumber: string
  supplierName: string
  supplierContactName?: string
  projectName: string
  projectAddress?: string | null
  companyName: string
  companyLogo?: string
  companyPhone?: string
  companyEmail?: string
  companyAddress?: string
  items: Array<{
    name: string
    description?: string | null
    quantity: number
    unitType?: string | null
    unitPrice: number
    totalPrice: number
    sku?: string | null
    brand?: string | null
    color?: string | null
    finish?: string | null
    notes?: string | null
    images?: string[] | null
  }>
  subtotal: number
  taxAmount?: number
  shippingCost?: number
  totalAmount: number
  currency?: string
  shippingAddress?: string | null
  shippingMethod?: string | null
  expectedDelivery?: Date | null
  notes?: string | null
  paymentTerms?: string
  orderDate: Date
}

export function generatePurchaseOrderEmailTemplate(data: PurchaseOrderEmailData): {
  subject: string
  html: string
} {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: data.currency || 'CAD',
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const subject = `Purchase Order ${data.poNumber} from ${data.companyName}`

  // Build item rows HTML
  const itemRowsHtml = data.items.map((item, index) => {
    const imageUrl = item.images?.[0]
    const specs = [
      item.sku && `SKU: ${item.sku}`,
      item.brand && `Brand: ${item.brand}`,
      item.color && `Color: ${item.color}`,
      item.finish && `Finish: ${item.finish}`,
    ].filter(Boolean).join(' | ')

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px; vertical-align: top; width: 50px; color: #6b7280; font-size: 14px;">${index + 1}</td>
        <td style="padding: 16px; vertical-align: top;">
          <div style="display: flex; gap: 12px;">
            ${imageUrl ? `
              <img src="${imageUrl}" alt="${item.name}"
                   style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; flex-shrink: 0;" />
            ` : ''}
            <div>
              <div style="font-weight: 600; color: #111827; font-size: 14px;">${item.name}</div>
              ${item.description ? `<div style="color: #6b7280; font-size: 13px; margin-top: 4px;">${item.description}</div>` : ''}
              ${specs ? `<div style="color: #9ca3af; font-size: 12px; margin-top: 4px;">${specs}</div>` : ''}
              ${item.notes ? `<div style="color: #b45309; font-size: 12px; margin-top: 4px; font-style: italic;">Note: ${item.notes}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 16px; vertical-align: top; text-align: center; white-space: nowrap;">
          <div style="font-weight: 600; color: #111827;">${item.quantity}</div>
          <div style="color: #6b7280; font-size: 12px;">${item.unitType || 'units'}</div>
        </td>
        <td style="padding: 16px; vertical-align: top; text-align: right; color: #374151;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding: 16px; vertical-align: top; text-align: right; font-weight: 600; color: #111827;">${formatCurrency(item.totalPrice)}</td>
      </tr>
    `
  }).join('')

  const shippingInfoHtml = data.shippingAddress ? `
    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
        Shipping Information
      </h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Delivery Address</div>
          <div style="color: #111827; font-size: 14px; white-space: pre-line;">${data.shippingAddress}</div>
        </div>
        <div>
          ${data.shippingMethod ? `
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Shipping Method</div>
            <div style="color: #111827; font-size: 14px;">${data.shippingMethod}</div>
          ` : ''}
          ${data.expectedDelivery ? `
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px; margin-top: 12px;">Expected Delivery</div>
            <div style="color: #111827; font-size: 14px;">${formatDate(data.expectedDelivery)}</div>
          ` : ''}
        </div>
      </div>
    </div>
  ` : ''

  const notesHtml = data.notes ? `
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 12px; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">Special Instructions</div>
      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${data.notes}</p>
    </div>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Purchase Order ${data.poNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
    <div style="max-width: 700px; margin: 0 auto; background: white;">
        <!-- Header with Company Branding -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; text-align: center;">
            ${data.companyLogo ? `
            <img src="${data.companyLogo}"
                 alt="${data.companyName}"
                 style="max-width: 200px; max-height: 70px; height: auto; margin-bottom: 20px; background-color: white; padding: 14px; border-radius: 8px;" />
            ` : `
            <div style="color: white; font-size: 28px; font-weight: 700; margin-bottom: 20px;">${data.companyName}</div>
            `}
            <div style="display: inline-block; background: #10b981; color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                Purchase Order
            </div>
            <h1 style="margin: 16px 0 0 0; color: white; font-size: 32px; font-weight: 700;">${data.poNumber}</h1>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            <!-- Greeting -->
            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px;">
                Dear ${data.supplierContactName || data.supplierName},
            </p>

            <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 15px;">
                Please find below our official purchase order. We kindly request confirmation of this order and estimated delivery date.
            </p>

            <!-- Order Details Card -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">PO Number:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${data.poNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order Date:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formatDate(data.orderDate)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${data.projectName}</td>
                    </tr>
                    ${data.projectAddress ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project Address:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${data.projectAddress}</td>
                    </tr>
                    ` : ''}
                    ${data.paymentTerms ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Terms:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${data.paymentTerms}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            <!-- Shipping Information -->
            ${shippingInfoHtml}

            <!-- Special Instructions -->
            ${notesHtml}

            <!-- Items Table -->
            <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 16px; font-weight: 600; border-bottom: 2px solid #111827; padding-bottom: 8px;">
                Order Items (${data.items.length})
            </h3>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">#</th>
                        <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Item Details</th>
                        <th style="padding: 12px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
                        <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Unit Price</th>
                        <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRowsHtml}
                </tbody>
            </table>

            <!-- Totals -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; max-width: 300px; margin-left: auto;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
                        <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px;">${formatCurrency(data.subtotal)}</td>
                    </tr>
                    ${data.taxAmount ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tax</td>
                        <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px;">${formatCurrency(data.taxAmount)}</td>
                    </tr>
                    ` : ''}
                    ${data.shippingCost ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Shipping</td>
                        <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px;">${formatCurrency(data.shippingCost)}</td>
                    </tr>
                    ` : ''}
                    <tr style="border-top: 2px solid #e5e7eb;">
                        <td style="padding: 16px 0 8px 0; color: #111827; font-size: 18px; font-weight: 700;">Total</td>
                        <td style="padding: 16px 0 8px 0; text-align: right; color: #111827; font-size: 18px; font-weight: 700;">${formatCurrency(data.totalAmount)}</td>
                    </tr>
                </table>
            </div>

            <!-- Action Required Box -->
            <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
                <div style="font-size: 16px; color: #065f46; font-weight: 600; margin-bottom: 8px;">
                    Please Confirm This Order
                </div>
                <p style="margin: 0; color: #047857; font-size: 14px;">
                    Reply to this email to confirm receipt and provide estimated delivery date.
                </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

            <!-- Company Contact Info -->
            <div style="text-align: center;">
                <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">${data.companyName}</p>
                ${data.companyAddress ? `<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">${data.companyAddress}</p>` : ''}
                <p style="margin: 0; color: #6b7280; font-size: 13px;">
                    ${data.companyEmail || 'info@company.com'}
                    ${data.companyPhone ? ` | ${data.companyPhone}` : ''}
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                This is an official purchase order from ${data.companyName}.
            </p>
            <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                &copy; ${new Date().getFullYear()} ${data.companyName}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}

/**
 * Budget Quote Email Template
 * Sent to clients for budget approval before detailed invoice
 */
export interface BudgetQuoteEmailData {
  budgetQuoteNumber: string
  clientName: string
  projectName: string
  companyName: string
  companyLogo?: string
  companyEmail?: string
  companyPhone?: string
  title: string
  description?: string | null
  items: Array<{
    name: string
    categoryName?: string
  }>
  estimatedTotal: number
  estimatedTotalUSD?: number // Separate USD total
  currency?: string
  includeTax: boolean
  includedServices: string[]
  validUntil?: Date | null
  portalUrl: string
  isTest?: boolean // For test email indicator
}

export function generateBudgetQuoteEmailTemplate(data: BudgetQuoteEmailData): {
  subject: string
  html: string
} {
  const formatCurrencyCAD = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const formatCurrencyUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // For backward compatibility
  const formatCurrency = formatCurrencyCAD

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const subject = `Budget Estimate for ${data.projectName} - ${data.title}`

  // Group items by category
  const itemsByCategory = data.items.reduce((acc, item) => {
    const cat = item.categoryName || 'Items'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item.name)
    return acc
  }, {} as Record<string, string[]>)

  const itemsHtml = Object.entries(itemsByCategory).map(([category, items]) => `
    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; color: #374151; font-size: 14px; margin-bottom: 8px;">${category}</div>
      <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 13px;">
        ${items.map(item => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
      </ul>
    </div>
  `).join('')

  const servicesHtml = data.includedServices.length > 0 ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="font-weight: 600; color: #166534; font-size: 14px; margin-bottom: 12px;">Included Services</div>
      <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 13px;">
        ${data.includedServices.map(s => `<li style="margin-bottom: 4px;">${s}</li>`).join('')}
      </ul>
    </div>
  ` : ''

  // Violet brand colors matching the budget quote page
  const violetColor = '#a78bfa' // violet-400
  const violetLight = '#ede9fe' // violet-100
  const violetDark = '#4c1d95' // violet-900
  const violetMuted = '#7c3aed' // violet-600

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Budget Estimate - ${data.title}</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Main Card -->
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

            <!-- Header -->
            <div style="background: ${violetColor}; padding: 32px 24px; text-align: center;">
                <div style="background: white; display: inline-block; padding: 8px 16px; border-radius: 16px; margin-bottom: 16px;">
                    <span style="color: ${violetMuted}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Budget Approval</span>
                </div>
                <h1 style="margin: 0 0 8px 0; color: white; font-size: 24px; font-weight: 600;">${data.title}</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">for ${data.projectName}</p>
            </div>

            <!-- Budget Amount Card -->
            <div style="background: ${violetLight}; padding: 32px 24px; text-align: center;">
                <p style="margin: 0 0 12px 0; color: ${violetMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Budget for Selected Items</p>
                ${data.estimatedTotal > 0 ? `
                <p style="margin: 0; color: ${violetDark}; font-size: 36px; font-weight: 700;">${formatCurrencyCAD(data.estimatedTotal)} <span style="font-size: 16px; font-weight: 400; color: ${violetMuted};">CAD</span></p>
                ` : ''}
                ${data.estimatedTotalUSD && data.estimatedTotalUSD > 0 ? `
                <p style="margin: 12px 0 0 0; color: ${violetDark}; font-size: 36px; font-weight: 700;">${formatCurrencyUSD(data.estimatedTotalUSD)} <span style="font-size: 16px; font-weight: 400; color: ${violetMuted};">USD</span></p>
                ` : ''}
                ${data.includeTax ? `<p style="margin: 8px 0 0 0; color: #7c3aed; font-size: 13px;">+ applicable taxes</p>` : ''}
                <p style="margin: 8px 0 0 0; color: #a78bfa; font-size: 11px;">* Delivery fees and duties may apply</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px 24px;">
                <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                    Hi ${data.clientName},<br><br>
                    We've prepared a budget estimate for your review. Click the button below to see the full details and approve.
                </p>

                ${data.description ? `
                <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">${data.description}</p>
                </div>
                ` : ''}

                ${data.validUntil ? `
                <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 13px; text-align: center;">
                    Valid until <strong style="color: #374151;">${formatDate(data.validUntil)}</strong>
                </p>
                ` : ''}

                <!-- Items Summary -->
                <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; font-weight: 600;">Items Included</p>
                    ${Object.entries(itemsByCategory).map(([category, items]) => `
                    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 4px 0; color: #374151; font-size: 13px; font-weight: 500;">${category}</p>
                        <p style="margin: 0; color: #6b7280; font-size: 12px;">${(items as string[]).length} item${(items as string[]).length !== 1 ? 's' : ''}</p>
                    </div>
                    `).join('')}
                    <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px; text-align: center;">Full details available in the portal</p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${data.portalUrl}" style="display: inline-block; background: ${violetMuted}; color: white; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        Review &amp; Approve
                    </a>
                </div>

                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                    Click the button above to review details and approve this estimate.
                </p>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
                <img src="https://app.meisnerinteriors.com/meisnerinteriorlogo.png" alt="Meisner Interiors" style="height: 48px; margin-bottom: 12px;" />
                <p style="margin: 0; color: #9ca3af; font-size: 11px;">Interior Design & Project Management</p>
            </div>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}

/**
 * Budget Quote Approval Notification Email
 * Sent to team when client approves a budget quote
 */
export interface BudgetApprovalNotificationData {
  budgetQuoteNumber: string
  clientName: string
  projectName: string
  title: string
  estimatedTotal: number
  currency?: string
  approvedAt: Date
  dashboardUrl: string
}

export function generateBudgetApprovalNotificationEmail(data: BudgetApprovalNotificationData): {
  subject: string
  html: string
} {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: data.currency || 'CAD',
    }).format(amount)
  }

  const subject = `Budget Approved: ${data.title} - ${data.projectName}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px;">
        <div style="background: #10b981; padding: 24px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">✓</div>
            <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">Budget Approved!</h1>
        </div>
        <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px;">
                <strong>${data.clientName}</strong> has approved the budget estimate.
            </p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Project</div>
                    <div style="font-size: 14px; color: #111827; font-weight: 500;">${data.projectName}</div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Budget</div>
                    <div style="font-size: 14px; color: #111827; font-weight: 500;">${data.title}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Amount</div>
                    <div style="font-size: 18px; color: #10b981; font-weight: 700;">${formatCurrency(data.estimatedTotal)}</div>
                </div>
            </div>
            <div style="text-align: center;">
                <a href="${data.dashboardUrl}"
                   style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
                    View in Dashboard
                </a>
            </div>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}

/**
 * Budget Quote Question Notification Email
 * Sent to team when client asks a question
 */
export interface BudgetQuestionNotificationData {
  budgetQuoteNumber: string
  clientName: string
  clientEmail?: string
  projectName: string
  title: string
  question: string
  dashboardUrl: string
}

export function generateBudgetQuestionNotificationEmail(data: BudgetQuestionNotificationData): {
  subject: string
  html: string
} {
  const subject = `Question about Budget: ${data.title} - ${data.projectName}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px;">
        <div style="background: #f59e0b; padding: 24px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">?</div>
            <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">Client Question</h1>
        </div>
        <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px;">
                <strong>${data.clientName}</strong> has a question about the budget estimate.
            </p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 11px; color: #92400e; text-transform: uppercase; margin-bottom: 8px;">Question</div>
                <div style="font-size: 14px; color: #78350f; line-height: 1.5;">${data.question}</div>
            </div>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Project</div>
                    <div style="font-size: 14px; color: #111827;">${data.projectName}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Budget</div>
                    <div style="font-size: 14px; color: #111827;">${data.title}</div>
                </div>
            </div>
            ${data.clientEmail ? `
            <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px;">
                Reply to: <a href="mailto:${data.clientEmail}" style="color: #7c3aed;">${data.clientEmail}</a>
            </p>
            ` : ''}
            <div style="text-align: center;">
                <a href="${data.dashboardUrl}"
                   style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
                    View in Dashboard
                </a>
            </div>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}
