import { NextResponse } from 'next/server'
import { createOverdueNotifications, sendOverdueEmailNotifications } from '@/lib/notifications/overdue-notifications'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // This endpoint should be called by a cron service (like Vercel Cron or external scheduler)
    // You might want to add authentication/authorization here for security

    // Get all organizations to process notifications
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true }
    })
    
    let totalNotificationsCreated = 0
    let totalEmailsSent = 0
    
    for (const org of organizations) {
      try {
        // Create in-app notifications for overdue phases
        await createOverdueNotifications(org.id)
        
        // Send email notifications for critical overdue phases
        await sendOverdueEmailNotifications(org.id)
        
        totalNotificationsCreated++

      } catch (orgError) {
        console.error(`Error processing notifications for org ${org.name}:`, orgError)
        // Continue processing other organizations even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed overdue notifications for ${totalNotificationsCreated} organizations`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error running overdue notifications cron job:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to run overdue notifications cron job',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Optional: Also support GET for manual testing
export async function GET() {
  // For testing purposes, you might want to allow manual triggering
  // In production, you should remove this or add proper authentication
  return POST()
}