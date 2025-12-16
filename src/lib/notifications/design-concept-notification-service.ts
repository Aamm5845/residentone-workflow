import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email-service';
import { getTwilioClient } from '@/lib/twilio';
import { getBaseUrl } from '@/lib/get-base-url';

/**
 * Notify Vitor when a design concept item is added
 */
export async function notifyItemAdded({
  itemName,
  projectName,
  roomName,
  addedBy,
  stageId,
}: {
  itemName: string;
  projectName: string;
  roomName: string;
  addedBy: { name: string; email: string };
  stageId: string;
}) {
  console.log(`[Design Notification] notifyItemAdded called - Item: ${itemName}, AddedBy: ${addedBy.name || addedBy.email}`);
  
  try {
    // Find Vitor's user account (check actual email, name, or role)
    const vitor = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'euvi.3d@gmail.com' },
          { email: { contains: 'vitor', mode: 'insensitive' } },
          { name: { contains: 'vitor', mode: 'insensitive' } },
          { role: 'RENDERER' },
        ],
      },
    });

    if (!vitor) {
      console.warn('[Design Notification] Vitor/Renderer user not found - skipping notification');
      return;
    }

    console.log(`[Design Notification] Found renderer: ${vitor.name} (${vitor.email}), emailNotificationsEnabled: ${vitor.emailNotificationsEnabled}`);

    // Send email notification (default to enabled unless explicitly disabled)
    if (vitor.emailNotificationsEnabled !== false) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎨 New Design Item Added</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${vitor.name || 'Vitor'},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${addedBy.name || addedBy.email}</strong> has added a new item to the design concept:
            </p>
            
            <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0;"><strong>Item:</strong> ${itemName}</p>
              <p style="margin: 0 0 10px 0;"><strong>Project:</strong> ${projectName}</p>
              <p style="margin: 0;"><strong>Room:</strong> ${roomName}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Please review this item and work on incorporating it into the 3D render.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/stages/${stageId}" 
                 style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                View Design Concept
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This is an automated notification from your Design Workflow system.
            </p>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: vitor.email,
        subject: `🎨 New Design Item: ${itemName} - ${projectName}`,
        html: emailHtml,
      });

      console.log(`[Design Notification] Email sent to ${vitor.name || vitor.email} about new item: ${itemName}`);
    } else {
      console.log(`[Design Notification] Email notifications disabled for ${vitor.name || vitor.email} - skipping`);
    }
  } catch (error) {
    console.error('[Design Notification] Error sending item added notification:', error);
    // Don't throw - we don't want to fail the main operation if notification fails
  }
}

/**
 * Notify Aaron when a design concept item is completed
 */
export async function notifyItemCompleted({
  itemName,
  projectName,
  roomName,
  completedBy,
  stageId,
}: {
  itemName: string;
  projectName: string;
  roomName: string;
  completedBy: { name: string; email: string };
  stageId: string;
}) {
  try {
    // Find Aaron's user account
    const aaron = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'aaron', mode: 'insensitive' } },
          { name: { contains: 'aaron', mode: 'insensitive' } },
          { role: 'OWNER' }, // Fallback to owner role
        ],
      },
    });

    if (!aaron) {
      console.warn('[Design Notification] Aaron user not found - skipping notification');
      return;
    }

    // Send Email Notification
    if (aaron.emailNotificationsEnabled) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Design Item Completed</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${aaron.name || 'Aaron'},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! <strong>${completedBy.name || completedBy.email}</strong> has completed a design item:
            </p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0;"><strong>Item:</strong> ${itemName}</p>
              <p style="margin: 0 0 10px 0;"><strong>Project:</strong> ${projectName}</p>
              <p style="margin: 0;"><strong>Room:</strong> ${roomName}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              The render for this item is now ready for your review.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}/stages/${stageId}" 
                 style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                Review Design
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This is an automated notification from your Design Workflow system.
            </p>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: aaron.email,
        subject: `✅ Design Item Completed: ${itemName} - ${projectName}`,
        html: emailHtml,
      });

      console.log(`[Design Notification] Email sent to Aaron about completed item: ${itemName}`);
    }

    // Send SMS Notification
    if (aaron.smsNotificationsEnabled && aaron.phoneNumber) {
      const twilioClient = getTwilioClient();
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (twilioClient && twilioPhoneNumber) {
        // Format phone number
        let formattedPhone = aaron.phoneNumber;
        if (!formattedPhone.startsWith('+')) {
          const digitsOnly = formattedPhone.replace(/\D/g, '');
          formattedPhone = `+1${digitsOnly}`;
        }

        const smsBody = `✅ Design item completed by ${completedBy.name || 'Vitor'}: "${itemName}" for ${projectName} - ${roomName}. Ready for review!`;

        await twilioClient.messages.create({
          body: smsBody,
          from: twilioPhoneNumber,
          to: formattedPhone,
        });

        console.log(`[Design Notification] SMS sent to Aaron about completed item: ${itemName}`);
      } else {
        console.warn('[Design Notification] Twilio not configured - SMS notification skipped');
      }
    }
  } catch (error) {
    console.error('[Design Notification] Error sending item completed notification:', error);
    // Don't throw - we don't want to fail the main operation if notification fails
  }
}
