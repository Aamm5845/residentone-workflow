import { sendEmail } from './email-service'

interface MeetingEmailData {
  title: string
  date: Date | string
  startTime: Date | string
  endTime?: Date | string
  locationType: string
  locationDetails?: string | null
  meetingLink?: string | null
  description?: string | null
  organizerName?: string
  projectName?: string | null
}

interface MeetingEmailOptions {
  to: string
  attendeeName: string
  meeting: MeetingEmailData
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getLocationLabel(type: string): string {
  switch (type) {
    case 'VIRTUAL': return 'Virtual Meeting'
    case 'IN_OFFICE': return 'In Office'
    case 'ON_SITE': return 'On Site'
    default: return type
  }
}

function buildMeetingDetailsHtml(meeting: MeetingEmailData): string {
  const locationLabel = getLocationLabel(meeting.locationType)
  const dateStr = formatDate(meeting.date)
  const startStr = formatTime(meeting.startTime)
  const endStr = meeting.endTime ? formatTime(meeting.endTime) : ''

  let html = `
    <div style="background: #f8f9fa; border-radius: 8px; padding: 16px 20px; margin: 16px 0; border-left: 4px solid #a657f0;">
      <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1a1a2e;">${meeting.title}</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #444;">
        <strong>Date:</strong> ${dateStr}
      </p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #444;">
        <strong>Time:</strong> ${startStr}${endStr ? ` - ${endStr}` : ''}
      </p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #444;">
        <strong>Location:</strong> ${locationLabel}${meeting.locationDetails ? ` - ${meeting.locationDetails}` : ''}
      </p>`

  if (meeting.projectName) {
    html += `
      <p style="margin: 0 0 4px; font-size: 14px; color: #444;">
        <strong>Project:</strong> ${meeting.projectName}
      </p>`
  }

  if (meeting.description) {
    html += `
      <p style="margin: 8px 0 0; font-size: 13px; color: #666; line-height: 1.4;">
        ${meeting.description}
      </p>`
  }

  html += `</div>`

  if (meeting.meetingLink) {
    html += `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${meeting.meetingLink}"
           style="display: inline-block; background: #a657f0; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Join Meeting
        </a>
      </div>`
  }

  return html
}

function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #a657f0 0%, #7c3aed 100%); padding: 20px 24px;">
      <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 700;">StudioFlow</h1>
    </div>
    <div style="padding: 24px;">
      ${body}
    </div>
    <div style="padding: 12px 24px; background: #f8f9fa; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #999;">Sent by StudioFlow Meeting Scheduler</p>
    </div>
  </div>
</body>
</html>`
}

// =============================================
// Public email functions
// =============================================

export async function sendMeetingInvitation(options: MeetingEmailOptions) {
  const { to, attendeeName, meeting } = options
  const dateStr = formatDate(meeting.date)

  const body = `
    <p style="font-size: 15px; color: #333; margin: 0 0 8px;">Hi ${attendeeName},</p>
    <p style="font-size: 14px; color: #555; margin: 0 0 16px; line-height: 1.5;">
      ${meeting.organizerName || 'A team member'} has invited you to a meeting.
    </p>
    ${buildMeetingDetailsHtml(meeting)}
    <p style="font-size: 13px; color: #888; margin: 16px 0 0;">
      If you have any questions, please reach out to the organizer.
    </p>`

  return sendEmail({
    to,
    subject: `Meeting: ${meeting.title} - ${dateStr}`,
    html: wrapEmailHtml(body),
  })
}

export async function sendMeetingReminder(options: MeetingEmailOptions) {
  const { to, attendeeName, meeting } = options
  const startStr = formatTime(meeting.startTime)

  const body = `
    <p style="font-size: 15px; color: #333; margin: 0 0 8px;">Hi ${attendeeName},</p>
    <p style="font-size: 14px; color: #555; margin: 0 0 16px; line-height: 1.5;">
      This is a reminder that your meeting is coming up soon.
    </p>
    ${buildMeetingDetailsHtml(meeting)}
    <p style="font-size: 13px; color: #888; margin: 16px 0 0;">
      Don't forget to join on time!
    </p>`

  return sendEmail({
    to,
    subject: `Reminder: ${meeting.title} at ${startStr}`,
    html: wrapEmailHtml(body),
  })
}

export async function sendMeetingCancellation(options: {
  to: string
  attendeeName: string
  meeting: { title: string; date: Date | string; startTime: Date | string; organizerName?: string }
}) {
  const { to, attendeeName, meeting } = options
  const dateStr = formatDate(meeting.date)
  const startStr = formatTime(meeting.startTime)

  const body = `
    <p style="font-size: 15px; color: #333; margin: 0 0 8px;">Hi ${attendeeName},</p>
    <p style="font-size: 14px; color: #555; margin: 0 0 16px; line-height: 1.5;">
      The following meeting has been <strong style="color: #e74c3c;">cancelled</strong> by ${meeting.organizerName || 'the organizer'}.
    </p>
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px 20px; margin: 16px 0; border-left: 4px solid #e74c3c;">
      <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1a1a2e; text-decoration: line-through;">${meeting.title}</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #666;">
        ${dateStr} at ${startStr}
      </p>
    </div>
    <p style="font-size: 13px; color: #888; margin: 16px 0 0;">
      Please remove this from your calendar. Contact the organizer if you have any questions.
    </p>`

  return sendEmail({
    to,
    subject: `Cancelled: ${meeting.title}`,
    html: wrapEmailHtml(body),
  })
}

export async function sendMeetingUpdate(options: MeetingEmailOptions) {
  const { to, attendeeName, meeting } = options
  const dateStr = formatDate(meeting.date)

  const body = `
    <p style="font-size: 15px; color: #333; margin: 0 0 8px;">Hi ${attendeeName},</p>
    <p style="font-size: 14px; color: #555; margin: 0 0 16px; line-height: 1.5;">
      ${meeting.organizerName || 'The organizer'} has updated the following meeting. Please review the updated details below.
    </p>
    ${buildMeetingDetailsHtml(meeting)}
    <p style="font-size: 13px; color: #888; margin: 16px 0 0;">
      Please update your calendar accordingly.
    </p>`

  return sendEmail({
    to,
    subject: `Updated: ${meeting.title} - ${dateStr}`,
    html: wrapEmailHtml(body),
  })
}
