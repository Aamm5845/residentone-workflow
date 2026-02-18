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

interface AttendeeInfo {
  name: string
  email?: string
  type: string // TEAM_MEMBER, CLIENT, CONTRACTOR, SUBCONTRACTOR, EXTERNAL
}

interface MeetingEmailOptions {
  to: string
  attendeeName: string
  meeting: MeetingEmailData
  attendees?: AttendeeInfo[]
  meetingId?: string
  attendeeId?: string
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
  })
}

function formatTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Toronto',
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

function getLocationIcon(type: string): string {
  switch (type) {
    case 'VIRTUAL': return '💻'
    case 'IN_OFFICE': return '🏢'
    case 'ON_SITE': return '📍'
    default: return '📅'
  }
}

function getAttendeeTypeLabel(type: string): string {
  switch (type) {
    case 'TEAM_MEMBER': return 'Team'
    case 'CLIENT': return 'Client'
    case 'CONTRACTOR': return 'Contractor'
    case 'SUBCONTRACTOR': return 'Subcontractor'
    case 'EXTERNAL': return 'Guest'
    default: return ''
  }
}

function buildAttendeesHtml(attendees?: AttendeeInfo[]): string {
  if (!attendees || attendees.length === 0) return ''

  const attendeeRows = attendees.map((att) => {
    const typeLabel = getAttendeeTypeLabel(att.type)
    const typeBadgeColor = att.type === 'CLIENT' ? '#2563eb'
      : att.type === 'CONTRACTOR' || att.type === 'SUBCONTRACTOR' ? '#7c3aed'
      : att.type === 'EXTERNAL' ? '#64748b'
      : '#1e293b'

    return `
      <tr>
        <td style="padding: 6px 0; vertical-align: middle;">
          <span style="font-size: 14px; color: #1e293b; font-weight: 500;">${att.name}</span>
        </td>
        <td style="padding: 6px 0; text-align: right; vertical-align: middle;">
          <span style="display: inline-block; font-size: 11px; color: ${typeBadgeColor}; background: ${typeBadgeColor}11; border: 1px solid ${typeBadgeColor}22; padding: 2px 8px; border-radius: 10px; font-weight: 500;">${typeLabel}</span>
        </td>
      </tr>`
  }).join('')

  return `
    <div style="margin: 20px 0;">
      <p style="margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
        Attendees (${attendees.length})
      </p>
      <div style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${attendeeRows}
          </tbody>
        </table>
      </div>
    </div>`
    .replace(/<td style="padding: 6px 0;/g, '<td style="padding: 8px 16px;')
}

function buildMeetingDetailsHtml(meeting: MeetingEmailData, attendees?: AttendeeInfo[]): string {
  const locationLabel = getLocationLabel(meeting.locationType)
  const locationIcon = getLocationIcon(meeting.locationType)
  const dateStr = formatDate(meeting.date)
  const startStr = formatTime(meeting.startTime)
  const endStr = meeting.endTime ? formatTime(meeting.endTime) : ''

  let html = `
    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1e293b;">${meeting.title}</p>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 90px; vertical-align: top;">📅 Date</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">🕐 Time</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${startStr}${endStr ? ` — ${endStr}` : ''}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">${locationIcon} Location</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${locationLabel}${meeting.locationDetails ? `<br><span style="color: #64748b; font-weight: 400;">${meeting.locationDetails}</span>` : ''}</td>
        </tr>`

  if (meeting.projectName) {
    html += `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">📁 Project</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${meeting.projectName}</td>
        </tr>`
  }

  if (meeting.organizerName) {
    html += `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">👤 Organizer</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${meeting.organizerName}</td>
        </tr>`
  }

  html += `
      </table>`

  if (meeting.description) {
    html += `
      <div style="margin: 16px 0 0; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">${meeting.description}</p>
      </div>`
  }

  html += `
    </div>`

  // Attendees section
  if (attendees && attendees.length > 0) {
    const attendeeItems = attendees.map((att) => {
      const typeLabel = getAttendeeTypeLabel(att.type)
      const typeBgColor = att.type === 'CLIENT' ? '#dbeafe'
        : att.type === 'CONTRACTOR' || att.type === 'SUBCONTRACTOR' ? '#ede9fe'
        : att.type === 'EXTERNAL' ? '#f1f5f9'
        : '#f0fdf4'
      const typeTextColor = att.type === 'CLIENT' ? '#1e40af'
        : att.type === 'CONTRACTOR' || att.type === 'SUBCONTRACTOR' ? '#6d28d9'
        : att.type === 'EXTERNAL' ? '#475569'
        : '#166534'

      return `
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b;">${att.name}</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-align: right;">
            <span style="display: inline-block; font-size: 11px; color: ${typeTextColor}; background: ${typeBgColor}; padding: 3px 10px; border-radius: 12px; font-weight: 600;">${typeLabel}</span>
          </td>
        </tr>`
    }).join('')

    html += `
      <div style="margin: 0 0 20px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
          Attendees · ${attendees.length}
        </p>
        <div style="background: white; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${attendeeItems}
            </tbody>
          </table>
        </div>
      </div>`
  }

  // Join meeting button
  if (meeting.meetingLink) {
    html += `
      <div style="text-align: center; margin: 24px 0 4px;">
        <a href="${meeting.meetingLink}"
           style="display: inline-block; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.01em;">
          Join Meeting →
        </a>
      </div>`
  }

  return html
}

function wrapEmailHtml(body: string, headerSubtitle?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting - Meisner Interiors</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

    <!-- Header with Logo -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 32px 28px; text-align: center;">
      <img src="https://app.meisnerinteriors.com/meisnerinteriorlogo.png"
           alt="Meisner Interiors"
           style="max-width: 180px; height: auto; margin-bottom: 16px; background-color: white; padding: 12px 16px; border-radius: 8px;" />
      ${headerSubtitle ? `<p style="margin: 0; color: #94a3b8; font-size: 14px; font-weight: 400;">${headerSubtitle}</p>` : ''}
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      ${body}
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Meisner Interiors</div>
      <div style="margin-bottom: 8px;">
        <a href="mailto:projects@meisnerinteriors.com"
           style="color: #2563eb; text-decoration: none; font-size: 12px;">projects@meisnerinteriors.com</a>
        <span style="color: #cbd5e1; margin: 0 6px;">·</span>
        <a href="tel:+15147976957"
           style="color: #2563eb; text-decoration: none; font-size: 12px;">514-797-6957</a>
      </div>
      <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; ${new Date().getFullYear()} Meisner Interiors. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
}

// =============================================
// Public email functions
// =============================================

export async function sendMeetingInvitation(options: MeetingEmailOptions) {
  const { to, attendeeName, meeting, attendees, meetingId, attendeeId } = options
  const dateStr = formatDate(meeting.date)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meisnerinteriors.com'

  // Build RSVP buttons if we have the IDs
  let rsvpHtml = ''
  if (meetingId && attendeeId) {
    const acceptUrl = `${baseUrl}/api/meetings/${meetingId}/respond?token=${attendeeId}&action=ACCEPTED`
    const declineUrl = `${baseUrl}/api/meetings/${meetingId}/respond?token=${attendeeId}&action=DECLINED`

    rsvpHtml = `
    <div style="text-align: center; margin: 24px 0 8px;">
      <p style="margin: 0 0 14px; font-size: 14px; color: #64748b; font-weight: 500;">Will you attend?</p>
      <div>
        <a href="${acceptUrl}"
           style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 0 6px;">
          ✓ Accept
        </a>
        <a href="${declineUrl}"
           style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 0 6px;">
          ✗ Decline
        </a>
      </div>
    </div>`
  }

  const body = `
    <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${attendeeName},</p>
    <p style="font-size: 15px; color: #475569; margin: 0 0 4px; line-height: 1.6;">
      You've been invited to a meeting by <strong style="color: #1e293b;">${meeting.organizerName || 'a team member'}</strong>.
    </p>
    ${buildMeetingDetailsHtml(meeting, attendees)}
    ${rsvpHtml}
    <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0; line-height: 1.5;">
      If you have any questions, please contact the organizer directly.
    </p>`

  return sendEmail({
    to,
    subject: `Meeting Invitation: ${meeting.title} — ${dateStr}`,
    html: wrapEmailHtml(body, 'Meeting Invitation'),
  })
}

export async function sendMeetingReminder(options: MeetingEmailOptions) {
  const { to, attendeeName, meeting, attendees } = options
  const startStr = formatTime(meeting.startTime)

  const body = `
    <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${attendeeName},</p>
    <p style="font-size: 15px; color: #475569; margin: 0 0 4px; line-height: 1.6;">
      Friendly reminder — your meeting is coming up soon.
    </p>
    ${buildMeetingDetailsHtml(meeting, attendees)}
    <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0;">
      See you there!
    </p>`

  return sendEmail({
    to,
    subject: `Reminder: ${meeting.title} at ${startStr}`,
    html: wrapEmailHtml(body, 'Meeting Reminder'),
  })
}

export async function sendMeetingCancellation(options: {
  to: string
  attendeeName: string
  meeting: { title: string; date: Date | string; startTime: Date | string; organizerName?: string }
  attendees?: AttendeeInfo[]
}) {
  const { to, attendeeName, meeting, attendees } = options
  const dateStr = formatDate(meeting.date)
  const startStr = formatTime(meeting.startTime)

  // Build attendees section for cancellation
  let attendeesHtml = ''
  if (attendees && attendees.length > 0) {
    const attendeeNames = attendees.map(a => a.name).join(', ')
    attendeesHtml = `
      <p style="margin: 12px 0 0; font-size: 13px; color: #64748b;">
        <strong>Attendees notified:</strong> ${attendeeNames}
      </p>`
  }

  const body = `
    <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${attendeeName},</p>
    <p style="font-size: 15px; color: #475569; margin: 0 0 20px; line-height: 1.6;">
      The following meeting has been <strong style="color: #dc2626;">cancelled</strong> by ${meeting.organizerName || 'the organizer'}.
    </p>

    <div style="background: #fef2f2; border-radius: 12px; padding: 20px 24px; margin: 0 0 20px; border: 1px solid #fecaca;">
      <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #1e293b; text-decoration: line-through;">${meeting.title}</p>
      <p style="margin: 0; font-size: 14px; color: #64748b;">
        📅 ${dateStr} &nbsp;·&nbsp; 🕐 ${startStr}
      </p>
      ${attendeesHtml}
    </div>

    <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5;">
      Please remove this from your calendar. Contact the organizer if you have questions.
    </p>`

  return sendEmail({
    to,
    subject: `Cancelled: ${meeting.title}`,
    html: wrapEmailHtml(body, 'Meeting Cancelled'),
  })
}

export async function sendMeetingUpdate(options: MeetingEmailOptions) {
  const { to, attendeeName, meeting, attendees } = options
  const dateStr = formatDate(meeting.date)

  const body = `
    <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${attendeeName},</p>
    <p style="font-size: 15px; color: #475569; margin: 0 0 4px; line-height: 1.6;">
      <strong style="color: #1e293b;">${meeting.organizerName || 'The organizer'}</strong> has updated the following meeting. Please review the new details.
    </p>
    ${buildMeetingDetailsHtml(meeting, attendees)}
    <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0;">
      Please update your calendar accordingly.
    </p>`

  return sendEmail({
    to,
    subject: `Updated: ${meeting.title} — ${dateStr}`,
    html: wrapEmailHtml(body, 'Meeting Updated'),
  })
}
