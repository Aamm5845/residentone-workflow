import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/budget-quotes/[id]/send
 * Mark budget quote as sent and optionally send email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { email, sendEmail = false } = body

    // Verify budget quote exists and belongs to org
    const budgetQuote = await prisma.budgetQuote.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: { id: true, name: true }
        },
        org: {
          select: { id: true, name: true }
        }
      }
    })

    if (!budgetQuote) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    // Update budget quote with sent info
    const updated = await prisma.budgetQuote.update({
      where: { id },
      data: {
        sentAt: new Date(),
        sentToEmail: email || budgetQuote.clientEmail,
        status: 'SENT'
      }
    })

    // Generate public URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const publicUrl = `${baseUrl}/budget-quote/${budgetQuote.token}`

    // TODO: Implement actual email sending here
    // For now, we just mark it as sent and return the URL
    if (sendEmail && (email || budgetQuote.clientEmail)) {
      // Email sending would go here
      // Could use nodemailer, resend, sendgrid, etc.
      console.log(`Would send budget quote email to: ${email || budgetQuote.clientEmail}`)
    }

    return NextResponse.json({
      success: true,
      budgetQuote: updated,
      publicUrl
    })
  } catch (error) {
    console.error('Error sending budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to send budget quote' },
      { status: 500 }
    )
  }
}
