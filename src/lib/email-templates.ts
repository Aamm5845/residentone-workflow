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

export function generateDeliveryEmailTemplate(data: EmailTemplateData): { subject: string; html: string } {
  const emailedAssets = data.assets.filter(asset => asset.includeInEmail);
  
  const subject = `Your Design Renderings are Ready - ${data.projectName}`;
  
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
        .intro {
            font-size: 16px;
            margin-bottom: 30px;
            color: #555;
        }
        .renderings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .rendering-item {
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
            background: #f8f9fa;
        }
        .rendering-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
        }
        .cta-container {
            text-align: center;
            margin: 40px 0;
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
        .secondary-cta {
            display: inline-block;
            background: #dc2626;
            color: white !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin-left: 15px;
            transition: background-color 0.2s;
        }
        .secondary-cta:hover {
            background: #b91c1c;
        }
        .footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .mobile-stack {
            display: block !important;
            width: 100% !important;
            margin-bottom: 10px !important;
            margin-left: 0 !important;
        }
        @media only screen and (max-width: 600px) {
            .container {
                padding: 20px;
            }
            .renderings-grid {
                grid-template-columns: 1fr;
            }
            .secondary-cta {
                margin-left: 0;
                margin-top: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ResidentOne</div>
            <h1>Your Design Renderings Are Ready!</h1>
        </div>

        <div class="intro">
            <p>Hi ${data.clientName},</p>
            <p>We're excited to share the latest renderings for <strong>${data.projectName}</strong>. Our design team has carefully crafted these visualizations to bring your vision to life.</p>
        </div>

        <div class="renderings-grid">
            ${emailedAssets.map(asset => `
                <div class="rendering-item">
                    <img src="${asset.url}" alt="Design Rendering" />
                </div>
            `).join('')}
        </div>

        <div class="cta-container">
            <p style="margin-bottom: 25px; font-size: 16px;">Please review the renderings and let us know your decision:</p>
            <a href="${data.approvalUrl}" class="cta-button">✓ Approve All Renderings</a>
            <a href="${data.approvalUrl}" class="secondary-cta">⚠ Request Revisions</a>
        </div>

        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">What happens next?</h3>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>If you approve:</strong> We'll move forward with the next phase of your project</li>
                <li><strong>If you need revisions:</strong> Please provide specific feedback, and we'll make the necessary adjustments</li>
            </ul>
        </div>

        <div class="footer">
            <p>Questions? Reply to this email or contact us at <a href="mailto:support@residentone.com">support@residentone.com</a></p>
            <p style="margin-top: 20px; color: #9ca3af;">
                This approval link will expire in 7 days. Please review and respond at your earliest convenience.
            </p>
            ${data.trackingPixelUrl ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:none;" />` : ''}
        </div>
    </div>
</body>
</html>`;

  return { subject, html };
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