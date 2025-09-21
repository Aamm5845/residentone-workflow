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
}): { subject: string; html: string } {
  const emailedAssets = data.assets.filter(asset => asset.includeInEmail);
  
  const subject = `✨ ${data.roomName || 'Your Space'} Design Ready for Approval - ${data.projectName}`;
  
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
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.7;
            color: #2d2926;
            background: linear-gradient(135deg, #f5f3f0 0%, #e8e4df 100%);
            padding: 20px 0;
        }
        .email-container {
            max-width: 700px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }
        
        /* Header with Meisner Branding */
        .header {
            background: linear-gradient(135deg, #2d2926 0%, #1a1815 100%);
            color: #f5f3f0;
            text-align: center;
            padding: 50px 40px;
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
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="%23ffffff" opacity="0.03"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>') repeat;
            opacity: 0.5;
        }
        .logo-container {
            position: relative;
            z-index: 2;
        }
        .meisner-logo {
            font-size: 36px;
            font-weight: 300;
            letter-spacing: 8px;
            text-transform: uppercase;
            margin-bottom: 8px;
            color: #d4af37;
        }
        .logo-subtitle {
            font-size: 14px;
            font-weight: 300;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: #a5a098;
            margin-bottom: 30px;
        }
        .header-divider {
            width: 80px;
            height: 1px;
            background: #d4af37;
            margin: 0 auto 25px;
        }
        .header-title {
            font-size: 28px;
            font-weight: 400;
            color: #f5f3f0;
            margin-bottom: 15px;
            line-height: 1.3;
        }
        .header-subtitle {
            font-size: 16px;
            color: #c5b8a8;
            font-weight: 300;
        }
        
        /* Content Area */
        .content {
            padding: 50px 40px;
        }
        .greeting {
            font-size: 18px;
            color: #2d2926;
            margin-bottom: 30px;
            line-height: 1.6;
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
        
        /* Renderings Gallery */
        .renderings-section {
            margin: 45px 0;
        }
        .section-title {
            font-size: 24px;
            color: #2d2926;
            text-align: center;
            margin-bottom: 15px;
            font-weight: 400;
        }
        .section-subtitle {
            text-align: center;
            color: #6b645c;
            font-size: 16px;
            margin-bottom: 40px;
            font-style: italic;
        }
        .renderings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin: 40px 0;
        }
        .rendering-card {
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: 1px solid #f0ede8;
        }
        .rendering-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
        }
        .rendering-image {
            width: 100%;
            height: 250px;
            object-fit: cover;
            display: block;
            border-bottom: 1px solid #f0ede8;
        }
        .rendering-caption {
            padding: 20px;
            text-align: center;
            background: #fefefe;
        }
        .rendering-caption h4 {
            color: #2d2926;
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 5px;
        }
        .rendering-caption p {
            color: #6b645c;
            font-size: 14px;
            font-style: italic;
        }
        
        /* Call-to-Action Section */
        .cta-section {
            background: #faf9f7;
            padding: 45px 30px;
            text-align: center;
            border-radius: 12px;
            margin: 45px 0;
            border: 1px solid #f0ede8;
        }
        .cta-title {
            font-size: 22px;
            color: #2d2926;
            margin-bottom: 20px;
            font-weight: 400;
        }
        .cta-description {
            color: #6b645c;
            font-size: 16px;
            margin-bottom: 35px;
            line-height: 1.6;
        }
        .cta-buttons {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .cta-button-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 18px 35px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
            border: none;
        }
        .cta-button-primary:hover {
            background: linear-gradient(135deg, #b8941f 0%, #9d7e1b 100%);
            box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
            transform: translateY(-2px);
        }
        .cta-button-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            color: #2d2926 !important;
            text-decoration: none;
            padding: 18px 35px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            border: 2px solid #d4af37;
        }
        .cta-button-secondary:hover {
            background: #d4af37;
            color: #ffffff !important;
            transform: translateY(-2px);
        }
        
        /* Next Steps Section */
        .next-steps {
            background: linear-gradient(135deg, #2d2926 0%, #1a1815 100%);
            color: #f5f3f0;
            padding: 45px 40px;
            border-radius: 12px;
            margin: 45px 0;
        }
        .next-steps h3 {
            color: #d4af37;
            font-size: 20px;
            margin-bottom: 25px;
            text-align: center;
            font-weight: 400;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .steps-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            margin-top: 30px;
        }
        .step-item {
            text-align: center;
            padding: 20px;
        }
        .step-icon {
            width: 60px;
            height: 60px;
            background: #d4af37;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 24px;
        }
        .step-title {
            color: #f5f3f0;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .step-description {
            color: #c5b8a8;
            font-size: 14px;
            line-height: 1.5;
        }
        
        /* Footer */
        .footer {
            background: #faf9f7;
            padding: 40px;
            text-align: center;
            border-top: 1px solid #f0ede8;
        }
        .footer-logo {
            font-size: 18px;
            color: #2d2926;
            font-weight: 600;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .footer-contact {
            color: #6b645c;
            font-size: 14px;
            margin-bottom: 15px;
        }
        .footer-contact a {
            color: #d4af37;
            text-decoration: none;
        }
        .footer-disclaimer {
            color: #a5a098;
            font-size: 12px;
            line-height: 1.4;
            margin-top: 25px;
            padding-top: 25px;
            border-top: 1px solid #e8e4df;
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
                <h1 class="header-title">Good News!</h1>
                <p class="header-subtitle">${data.roomName || 'Your Design'} Is Ready</p>
            </div>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <p>Dear ${data.clientName},</p>
                <p>We are delighted to present the completed design renderings for your <strong>${data.roomName || 'space'}</strong>. Our team has meticulously crafted every detail to transform your vision into a stunning reality.</p>
            </div>

            <!-- Project Information -->
            <div class="project-info">
                <h3>Project Details</h3>
                <div class="project-detail">
                    <span class="project-detail-label">Project</span>
                    <span class="project-detail-value">${data.projectName}</span>
                </div>
                <div class="project-detail">
                    <span class="project-detail-label">Room</span>
                    <span class="project-detail-value">${data.roomName || 'Interior Space'}</span>
                </div>
                ${data.designPhase ? `
                <div class="project-detail">
                    <span class="project-detail-label">Phase</span>
                    <span class="project-detail-value">${data.designPhase}</span>
                </div>
                ` : ''}
                ${data.projectAddress ? `
                <div class="project-detail">
                    <span class="project-detail-label">Location</span>
                    <span class="project-detail-value">${data.projectAddress}</span>
                </div>
                ` : ''}
            </div>

            <!-- Renderings Section -->
            <div class="renderings-section">
                <h2 class="section-title">Design Renderings</h2>
                <p class="section-subtitle">Carefully curated visualizations of your future space</p>
                
                <div class="renderings-grid">
                    ${emailedAssets.map((asset, index) => `
                        <div class="rendering-card">
                            <img src="${asset.url}" alt="${data.roomName} Design Rendering ${index + 1}" class="rendering-image" />
                            <div class="rendering-caption">
                                <h4>View ${index + 1}</h4>
                                <p>Interior Design Rendering</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Call to Action -->
            <div class="cta-section">
                <h2 class="cta-title">Your Approval is Needed</h2>
                <p class="cta-description">
                    Please review the renderings above and let us know if you approve of the design direction, or if you'd like us to make any adjustments.
                </p>
                <div class="cta-buttons">
                    <a href="${data.approvalUrl}" class="cta-button-primary">✓ Approve Design</a>
                    <a href="${data.approvalUrl}" class="cta-button-secondary">📝 Request Changes</a>
                </div>
            </div>

            <!-- Next Steps -->
            <div class="next-steps">
                <h3>What Happens Next?</h3>
                <div class="steps-grid">
                    <div class="step-item">
                        <div class="step-icon">✓</div>
                        <div class="step-title">You Approve</div>
                        <div class="step-description">Review the renderings and approve the design direction</div>
                    </div>
                    <div class="step-item">
                        <div class="step-icon">🎨</div>
                        <div class="step-title">We Finalize</div>
                        <div class="step-description">We'll complete the design specifications and material selections</div>
                    </div>
                    <div class="step-item">
                        <div class="step-icon">🏠</div>
                        <div class="step-title">Implementation</div>
                        <div class="step-description">Move forward with bringing your beautiful space to life</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-logo">Meisner Interiors</div>
            <p class="footer-contact">
                Questions? Contact us at <a href="mailto:hello@meisnerinteriors.com">hello@meisnerinteriors.com</a>
                <br>or call us at <a href="tel:+1-555-DESIGN">(555) DESIGN-1</a>
            </p>
            <div class="footer-disclaimer">
                <p>This approval link will expire in 14 days. Please review and respond at your earliest convenience.</p>
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
