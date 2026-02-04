import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/timesheet-reminders
 *
 * Sends email reminders to team members who haven't logged hours in 2-3 business days.
 * Excludes Friday, Saturday, and Sunday from the check.
 *
 * Should be run daily (Monday-Thursday) via Vercel Cron or external scheduler.
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

    // Skip running on Friday (5), Saturday (6), and Sunday (0)
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        message: 'Skipped - today is a weekend day (Fri/Sat/Sun)',
        skipped: true
      })
    }

    // Calculate the date range to check (last 2-3 business days)
    const checkFromDate = getBusinessDaysAgo(3) // Check if no entries in last 3 business days

    console.log(`Checking for missing timesheet entries since ${checkFromDate.toISOString()}`)

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

        // Check if user has any time entries in the check period
        const recentEntry = await prisma.timeEntry.findFirst({
          where: {
            userId: member.id,
            startTime: {
              gte: checkFromDate
            }
          },
          orderBy: { startTime: 'desc' }
        })

        // If no recent entries, send reminder
        if (!recentEntry) {
          const lastEntry = await prisma.timeEntry.findFirst({
            where: { userId: member.id },
            orderBy: { startTime: 'desc' },
            select: { startTime: true }
          })

          const lastEntryDate = lastEntry?.startTime
            ? formatDate(lastEntry.startTime)
            : 'never'

          // Send reminder email
          try {
            await sendTimesheetReminderEmail({
              to: member.email,
              userName: member.name || 'Team Member',
              organizationName: org.name,
              lastEntryDate,
              daysWithoutEntry: getDaysSince(lastEntry?.startTime)
            })

            usersToRemind.push(member.email)
            totalReminders++

            console.log(`Sent timesheet reminder to ${member.email}`)
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
      checkPeriodStart: checkFromDate.toISOString()
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
 * Get the date X business days ago (excluding Fri, Sat, Sun)
 */
function getBusinessDaysAgo(days: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  let businessDaysCount = 0

  while (businessDaysCount < days) {
    date.setDate(date.getDate() - 1)
    const dayOfWeek = date.getDay()

    // Count only Monday (1) through Thursday (4)
    // Skip Friday (5), Saturday (6), Sunday (0)
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      businessDaysCount++
    }
  }

  return date
}

/**
 * Calculate days since a date
 */
function getDaysSince(date?: Date | null): number {
  if (!date) return -1
  const now = new Date()
  const diffTime = now.getTime() - date.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

/**
 * Send timesheet reminder email
 */
async function sendTimesheetReminderEmail({
  to,
  userName,
  organizationName,
  lastEntryDate,
  daysWithoutEntry
}: {
  to: string
  userName: string
  organizationName: string
  lastEntryDate: string
  daysWithoutEntry: number
}) {
  const subject = `Reminder: Please log your hours - ${organizationName}`

  const daysText = daysWithoutEntry > 0
    ? `${daysWithoutEntry} day${daysWithoutEntry > 1 ? 's' : ''}`
    : 'a while'

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
            ⏰ Timesheet Reminder
          </h1>

          <p style="margin: 0 0 16px 0; font-size: 16px; color: #333; line-height: 1.5;">
            Hi ${userName},
          </p>

          <p style="margin: 0 0 16px 0; font-size: 16px; color: #333; line-height: 1.5;">
            We noticed you haven't logged any hours for <strong>${daysText}</strong>.
            Your last time entry was on <strong>${lastEntryDate}</strong>.
          </p>

          <p style="margin: 0 0 24px 0; font-size: 16px; color: #333; line-height: 1.5;">
            Please take a moment to update your timesheet so we can keep accurate records of project progress.
          </p>

          <a href="${process.env.NEXTAUTH_URL || 'https://app.meisnerinteriors.com'}/timeline"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
            Log Your Hours
          </a>

          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;">

          <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.5;">
            This is an automated reminder from ${organizationName}.
            If you were on leave or this doesn't apply to you, please disregard this message.
          </p>

        </div>

        <p style="margin: 16px 0 0 0; font-size: 12px; color: #999; text-align: center;">
          ${organizationName} • Timesheet Management
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
