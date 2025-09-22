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
  
  const subject = `✨ Good News! Your ${data.roomName || 'Design'} Is Ready - ${data.projectName}`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 0;
            margin: 0;
        }
        .email-container {
            max-width: 680px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }
        
        /* Modern Header */
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-align: center;
            padding: 60px 40px;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%), linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%);
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
            opacity: 0.3;
        }
        .logo-container {
            position: relative;
            z-index: 2;
        }
        .meisner-logo {
            font-size: 32px;
            font-weight: 400;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 8px;
            color: #ffffff;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .logo-subtitle {
            font-size: 12px;
            font-weight: 300;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.8);
            margin-bottom: 40px;
        }
        .header-divider {
            width: 60px;
            height: 2px;
            background: rgba(255,255,255,0.8);
            margin: 0 auto 30px;
            border-radius: 1px;
        }
        .header-title {
            font-size: 32px;
            font-weight: 300;
            color: #ffffff;
            margin-bottom: 15px;
            line-height: 1.2;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header-subtitle {
            font-size: 18px;
            color: rgba(255,255,255,0.9);
            font-weight: 300;
            letter-spacing: 0.5px;
        }
        
        /* Content Area */
        .content {
            padding: 50px 40px;
        }
        .greeting {
            font-size: 18px;
            color: #34495e;
            margin-bottom: 40px;
            line-height: 1.7;
            text-align: left;
        }
        .greeting p {
            margin-bottom: 20px;
        }
        .greeting strong {
            color: #2c3e50;
            font-weight: 600;
        }
        .project-info {
            background: #faf9f7;
            border-left: 4px solid #d4af37;
            padding: 25px;
            margin: 35px 0;
            border-radius: 0 8px 8px 0;
        }
        .project-info h3 {
            color: #2d2926;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .project-detail {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e8e4df;
        }
        .project-detail:last-child {
            border-bottom: none;
        }
        .project-detail-label {
            font-size: 14px;
            color: #6b645c;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
        }
        .project-detail-value {
            font-size: 16px;
            color: #2d2926;
            font-weight: 400;
        }
        
        /* Renderings Showcase */
        .renderings-section {
            margin: 50px 0;
            background: #f8f9fa;
            padding: 40px 0;
            border-radius: 8px;
        }
        .section-title {
            font-size: 28px;
            color: #2c3e50;
            text-align: center;
            margin-bottom: 12px;
            font-weight: 300;
            letter-spacing: 0.5px;
        }
        .section-subtitle {
            text-align: center;
            color: #7f8c8d;
            font-size: 16px;
            margin-bottom: 50px;
            font-weight: 300;
            line-height: 1.4;
        }
        .renderings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 30px;
            margin: 40px 0;
            padding: 0 40px;
        }
        .rendering-card {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: 1px solid rgba(0,0,0,0.04);
        }
        .rendering-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }
        .rendering-image {
            width: 100%;
            height: 240px;
            object-fit: cover;
            display: block;
        }
        .rendering-caption {
            padding: 24px;
            text-align: center;
            background: #ffffff;
        }
        .rendering-caption h4 {
            color: #2c3e50;
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 8px;
            letter-spacing: 0.3px;
        }
        .rendering-caption p {
            color: #95a5a6;
            font-size: 14px;
            font-weight: 400;
            margin: 0;
        }
        /* Hero Image Layout (when single image) */
        .hero-layout {
            text-align: center;
            margin: 40px 0;
        }
        .hero-image {
            width: 100%;
            max-width: 600px;
            height: auto;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin: 0 auto;
        }
        .hero-caption {
            margin-top: 24px;
            font-size: 18px;
            color: #7f8c8d;
            font-style: italic;
            font-weight: 300;
        }
        
        /* Download Section */
        .download-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 50px 40px;
            text-align: center;
            border-radius: 16px;
            margin: 50px 0;
            color: #ffffff;
        }
        .download-title {
            font-size: 26px;
            color: #ffffff;
            margin-bottom: 16px;
            font-weight: 300;
            letter-spacing: 0.5px;
        }
        .download-description {
            color: rgba(255,255,255,0.9);
            font-size: 16px;
            margin-bottom: 35px;
            line-height: 1.6;
            font-weight: 300;
        }
        .download-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.95);
            color: #667eea !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: none;
            gap: 10px;
        }
        .download-button:hover {
            background: #ffffff;
            box-shadow: 0 6px 30px rgba(0, 0, 0, 0.2);
            transform: translateY(-2px);
        }
        .download-icon {
            font-size: 18px;
        }
        
        /* Closing Message */
        .closing-section {
            background: #f8f9fa;
            padding: 40px;
            text-align: center;
            border-radius: 12px;
            margin: 40px 0;
        }
        .closing-title {
            font-size: 22px;
            color: #2c3e50;
            margin-bottom: 16px;
            font-weight: 300;
        }
        .closing-message {
            color: #7f8c8d;
            font-size: 16px;
            line-height: 1.6;
            font-weight: 300;
            max-width: 500px;
            margin: 0 auto;
        }
        
        /* Modern Footer */
        .footer {
            background: #34495e;
            padding: 50px 40px;
            text-align: center;
            color: #ffffff;
        }
        .footer-logo {
            font-size: 24px;
            color: #ffffff;
            font-weight: 300;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        .footer-tagline {
            color: rgba(255,255,255,0.7);
            font-size: 14px;
            margin-bottom: 30px;
            font-weight: 300;
            letter-spacing: 1px;
        }
        .footer-contact {
            color: rgba(255,255,255,0.9);
            font-size: 15px;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .footer-contact a {
            color: #ffffff;
            text-decoration: none;
            font-weight: 500;
        }
        .footer-contact a:hover {
            opacity: 0.8;
        }
        .footer-disclaimer {
            color: rgba(255,255,255,0.5);
            font-size: 12px;
            line-height: 1.4;
            margin-top: 30px;
            padding-top: 30px;
            border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            .header {
                padding: 40px 25px;
            }
            .content {
                padding: 40px 25px;
            }
            .cta-buttons {
                flex-direction: column;
                align-items: center;
            }
            .cta-button-primary,
            .cta-button-secondary {
                width: 100%;
                max-width: 280px;
                margin-bottom: 15px;
            }
            .renderings-grid {
                grid-template-columns: 1fr;
            }
            .steps-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <div class="logo-container">
                <div class="meisner-logo">MEISNER</div>
                <div class="logo-subtitle">I N T E R I O R S</div>
                <div class="header-divider"></div>
                <h1 class="header-title">✨ Good News!</h1>
                <p class="header-subtitle">Your ${data.roomName || 'Design'} Is Ready</p>
            </div>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <p>Dear ${data.clientName},</p>
                <p>We're excited to share the completed renderings for your <strong>${data.roomName || 'space'}</strong>. Every detail has been carefully crafted to bring your vision to life.</p>
            </div>

            <!-- Renderings Section -->
            <div class="renderings-section">
                <h2 class="section-title">${data.roomName || 'Design'} Renderings</h2>
                <p class="section-subtitle">Professional visualizations of your beautiful new space</p>
                
                ${emailedAssets.length === 1 ? `
                    <!-- Single Hero Image Layout -->
                    <div class="hero-layout">
                        <img src="${emailedAssets[0].url}" alt="${data.roomName} Design Rendering" class="hero-image" />
                        <p class="hero-caption">${data.roomName || 'Interior Design'} Rendering</p>
                    </div>
                ` : `
                    <!-- Multiple Images Grid -->
                    <div class="renderings-grid">
                        ${emailedAssets.slice(0, 4).map((asset, index) => `
                            <div class="rendering-card">
                                <img src="${asset.url}" alt="${data.roomName} Design Rendering ${index + 1}" class="rendering-image" />
                                <div class="rendering-caption">
                                    <h4>View ${index + 1}</h4>
                                    <p>Design Perspective</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${emailedAssets.length > 4 ? `<p style="text-align: center; color: #7f8c8d; margin-top: 20px; font-style: italic;">+ ${emailedAssets.length - 4} more rendering${emailedAssets.length > 5 ? 's' : ''} available for download</p>` : ''}
                `}
            </div>

            <!-- Download Section -->
            <div class="download-section">
                <h2 class="download-title">View & Download All Renderings</h2>
                <p class="download-description">
                    Click below to view all renderings and download high-resolution versions.
                </p>
                <a href="${data.approvalUrl}" class="download-button">
                    <span class="download-icon">👁</span>
                    View All Renderings
                </a>
            </div>

            <!-- Closing Message -->
            <div class="closing-section">
                <h3 class="closing-title">We look forward to finalizing this space together.</h3>
                <p class="closing-message">
                    Thank you for trusting us with your vision. We're here to answer any questions you may have about the design.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-logo">Meisner Interiors</div>
            <div class="footer-tagline">Transforming spaces, enriching lives</div>
            <p class="footer-contact">
                📧 <a href="mailto:projects@meisnerinteriors.com">projects@meisnerinteriors.com</a><br>
                📞 <a href="tel:+15147976957">514-797-6957</a>
            </p>
            <div class="footer-disclaimer">
                <p>© 2025 Meisner Interiors. All rights reserved.</p>
            </div>
            ${data.trackingPixelUrl ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:none;" />` : ''}
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
