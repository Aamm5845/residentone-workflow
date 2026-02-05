import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/timesheet-reminders
 *
 * Sends email reminders to team members who haven't logged hours in the last 2 business days.
 * Business days are Monday-Friday. Excludes user's registered off days.
 * Email includes specific dates that are missing time entries.
 *
 * Should be run daily (Monday-Friday) via Vercel Cron or external scheduler.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Check for Vercel cron header or CRON_SECRET
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Skip running on Saturday (6) and Sunday (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        message: 'Skipped - today is a weekend day (Sat/Sun)',
        skipped: true
      })
    }

    // Get the last 2 business days to check (Monday-Friday)
    const businessDaysToCheck = getLastBusinessDays(2)

    console.log(`Checking for missing timesheet entries for dates: ${businessDaysToCheck.map(d => formatDateShort(d)).join(', ')}`)

    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        businessEmail: true
      }
    })

    let totalReminders = 0
    const results: Array<{ org: string; reminders: number; users: string[] }> = []

    for (const org of organizations) {
      // Get all approved team members in this organization
      const teamMembers = await prisma.user.findMany({
        where: {
          orgId: org.id,
          approvalStatus: 'APPROVED',
          // Exclude users who might not need to track time
          role: {
            in: ['OWNER', 'ADMIN', 'MANAGER', 'DESIGNER', 'CONTRACTOR']
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      })

      const usersToRemind: string[] = []

      for (const member of teamMembers) {
        if (!member.email) continue

        // Get user's off days for the check period
        const userOffDays = await prisma.userOffDay.findMany({
          where: {
            userId: member.id,
            date: {
              in: businessDaysToCheck
            }
          },
          select: { date: true }
        })

        const offDayDates = new Set(userOffDays.map(od => od.date.toISOString().split('T')[0]))

        // Filter out off days from the days to check
        const daysToCheck = businessDaysToCheck.filter(
          day => !offDayDates.has(day.toISOString().split('T')[0])
        )

        // If all days are off days, skip this user
        if (daysToCheck.length === 0) {
          console.log(`Skipping ${member.email} - all days are marked as off`)
          continue
        }

        // Check which days are missing time entries
        const missingDays: Date[] = []

        for (const day of daysToCheck) {
          const dayStart = new Date(day)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(day)
          dayEnd.setHours(23, 59, 59, 999)

          const entryForDay = await prisma.timeEntry.findFirst({
            where: {
              userId: member.id,
              startTime: {
                gte: dayStart,
                lte: dayEnd
              }
            }
          })

          if (!entryForDay) {
            missingDays.push(day)
          }
        }

        // If there are missing days, send reminder
        if (missingDays.length > 0) {
          const lastEntry = await prisma.timeEntry.findFirst({
            where: { userId: member.id },
            orderBy: { startTime: 'desc' },
            select: { startTime: true }
          })

          // Send reminder email with specific missing dates
          try {
            await sendTimesheetReminderEmail({
              to: member.email,
              userName: member.name || 'Team Member',
              organizationName: org.name,
              missingDates: missingDays,
              lastEntryDate: lastEntry?.startTime ? formatDate(lastEntry.startTime) : null
            })

            usersToRemind.push(member.email)
            totalReminders++

            console.log(`Sent timesheet reminder to ${member.email} for missing dates: ${missingDays.map(d => formatDateShort(d)).join(', ')}`)
          } catch (emailError) {
            console.error(`Failed to send reminder to ${member.email}:`, emailError)
          }
        }
      }

      if (usersToRemind.length > 0) {
        results.push({
          org: org.name,
          reminders: usersToRemind.length,
          users: usersToRemind
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${totalReminders} timesheet reminders`,
      totalReminders,
      results,
      datesChecked: businessDaysToCheck.map(d => formatDateShort(d))
    })

  } catch (error) {
    console.error('Timesheet reminder cron error:', error)
    return NextResponse.json(
      { error: 'Failed to process timesheet reminders', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Get the last X business days (Monday-Friday), not including today
 */
function getLastBusinessDays(count: number): Date[] {
  const days: Date[] = []
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  while (days.length < count) {
    date.setDate(date.getDate() - 1)
    const dayOfWeek = date.getDay()

    // Include Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      days.push(new Date(date))
    }
  }

  return days.reverse() // Return in chronological order
}

/**
 * Format date for display (e.g., "Monday, Feb 3")
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

/**
 * Format date short (e.g., "Feb 3")
 */
function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

/**
 * Send timesheet reminder email with specific missing dates
 */
async function sendTimesheetReminderEmail({
  to,
  userName,
  organizationName,
  missingDates,
  lastEntryDate
}: {
  to: string
  userName: string
  organizationName: string
  missingDates: Date[]
  lastEntryDate: string | null
}) {
  const subject = `Reminder: Please log your hours - ${organizationName}`

  // Format the missing dates list
  const formattedDates = missingDates.map(d => formatDate(d))
  const missingDatesText = formattedDates.length === 1
    ? formattedDates[0]
    : formattedDates.slice(0, -1).join(', ') + ' and ' + formattedDates[formattedDates.length - 1]

  const lastEntryText = lastEntryDate
    ? `Your last time entry was on <strong>${lastEntryDate}</strong>.`
    : `We don't have any time entries recorded for you yet.`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
            Timesheet Reminder
          </h1>

          <p style="margin: 0 0 16px 0; font-size: 16px; color: #333; line-height: 1.5;">
            Hi ${userName},
          </p>

          <p style="margin: 0 0 16px 0; font-size: 16px; color: #333; line-height: 1.5;">
            We noticed you haven't logged any hours for the following date${missingDates.length > 1 ? 's' : ''}:
          </p>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 0 0 16px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 16px; color: #92400e; font-weight: 500;">
              ${missingDatesText}
            </p>
          </div>

          <p style="margin: 0 0 24px 0; font-size: 14px; color: #666; line-height: 1.5;">
            ${lastEntryText}
          </p>

          <p style="margin: 0 0 24px 0; font-size: 16px; color: #333; line-height: 1.5;">
            Please take a moment to update your timesheet so we can keep accurate records of project progress.
          </p>

          <a href="${process.env.NEXTAUTH_URL || 'https://app.meisnerinteriors.com'}/timeline"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
            Log Your Hours
          </a>

          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;">

          <p style="margin: 0 0 12px 0; font-size: 14px; color: #666; line-height: 1.5;">
            <strong>Taking time off?</strong> You can mark days as off in the Timeline page to avoid future reminders.
          </p>

          <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.5;">
            This is an automated reminder from ${organizationName}.
          </p>

        </div>

        <p style="margin: 16px 0 0 0; font-size: 12px; color: #999; text-align: center;">
          ${organizationName} - Timesheet Management
        </p>
      </div>
    </body>
    </html>
  `

  await sendEmail({
    to,
    subject,
    html
  })
}
