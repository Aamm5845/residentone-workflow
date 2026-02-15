import { NextResponse } from 'next/server'
import { taskNotificationService } from '@/lib/notifications/task-notification-service'

/**
 * Cron job: Send email reminders for tasks overdue by 3+ days.
 * Runs daily at 9:00 AM (configured in vercel.json).
 * Sends one reminder per overdue task every 3 days to avoid spam.
 */
export async function GET() {
  try {
    // Send overdue task reminders (3+ days past due)
    const overdueResult = await taskNotificationService.sendOverdueTaskReminders()

    // Also check for tasks due within 24 hours
    const dueSoonResult = await taskNotificationService.notifyTasksDueSoon()

    return NextResponse.json({
      success: true,
      overdue: {
        notificationsSent: overdueResult.notificationsSent,
        emailsSent: overdueResult.emailsSent,
        errors: overdueResult.errors,
      },
      dueSoon: {
        notificationsSent: dueSoonResult.notificationsSent,
        emailsSent: dueSoonResult.emailsSent,
        errors: dueSoonResult.errors,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error running task reminder cron job:', error)
    return NextResponse.json(
      {
        error: 'Failed to run task reminder cron job',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Support POST for cron trigger
export async function POST() {
  return GET()
}
