import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendInvoiceEmail } from '@/lib/send-invoice-email'

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// Helper to check billing access
async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    // Parse optional body for custom email settings
    let customEmail: string | undefined
    let customSubject: string | undefined
    let customMessage: string | undefined
    try {
      const body = await request.json()
      customEmail = body.email
      customSubject = body.subject
      customMessage = body.message
    } catch {
      // No body or invalid JSON is fine
    }

    await sendInvoiceEmail(id, session.user.orgId, {
      customEmail,
      customSubject,
      customMessage,
    })

    const invoice = await prisma.billingInvoice.findFirst({
      where: { id, orgId: session.user.orgId },
      select: { clientEmail: true },
    })

    const recipientEmail = customEmail || invoice?.clientEmail || 'client'

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${recipientEmail}`,
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    const message = error instanceof Error ? error.message : 'Failed to send invoice'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
