import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

// POST /api/users/[userId]/email/test - Send a test notification email to a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params

    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is editing their own settings or is an admin/owner
    const canEdit =
      session.user.id === resolvedParams.userId ||
      ['OWNER', 'ADMIN'].includes(session.user.role as string)

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: resolvedParams.userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailNotificationsEnabled: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!targetUser.email) {
      return NextResponse.json({
        error: 'Email address not set. Please add an email first.'
      }, { status: 400 })
    }

    if (!targetUser.emailNotificationsEnabled) {
      return NextResponse.json({
        error: 'Email notifications are disabled. Please enable them first.'
      }, { status: 400 })
    }

    // Build a simple preview email to show how notifications will look
    const subject = 'Studio Flow: Test Notification Email'

    const baseUrl = getBaseUrl()

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:28px 24px;text-align:center;">
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Studio Flow</div>
      <div style="color:#e0e7ff;font-size:14px;margin-top:6px;">Notification Preview</div>
    </div>

    <div style="padding:28px 24px;color:#0f172a;">
      <p style="margin:0 0 16px 0;font-size:16px;">Hi ${targetUser.name || 'there'},</p>
      <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.7;">
        This is a test email to confirm that email notifications are set up for your account in <strong>Studio Flow</strong>.
        When teammates mention you or you're assigned to important updates, you'll receive an email like this.
      </p>

      <div style="background:#f1f5f9;border-left:4px solid #7c3aed;padding:16px;border-radius:6px;margin:20px 0;">
        <div style="color:#0f172a;font-weight:600;margin-bottom:6px;">Example Notification</div>
        <div style="color:#475569;font-size:14px;">You were mentioned in a project chat. Open Studio Flow to reply.</div>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${baseUrl}" target="_blank" style="background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">
          Open Studio Flow
        </a>
      </div>

      <p style="margin:0;color:#475569;font-size:14px;">
        If you did not request this, you can adjust your notification preferences in your profile settings.
      </p>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px;text-align:center;color:#94a3b8;font-size:12px;">
      © ${new Date().getFullYear()} Studio Flow
    </div>
  </div>
</body>
</html>`

    const text = `Studio Flow - Test Notification Email\n\nEmail notifications are enabled for your account. You'll receive messages when you're mentioned or assigned.\n\nOpen Studio Flow: ${baseUrl}`

    const result = await sendEmail({
      to: targetUser.email,
      subject,
      html,
      text
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send test email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        to: targetUser.email,
        messageId: result.messageId
      }
    })

  } catch (error) {
    console.error('[Test Email] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
