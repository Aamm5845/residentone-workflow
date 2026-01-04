import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/send-email'
import { generateBudgetApprovalNotificationEmail, generateBudgetQuestionNotificationEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

// Notification email recipient
const NOTIFICATION_EMAIL = 'shaya@meisnerinteriors.com'

/**
 * POST /api/budget-quotes/public/[token]/respond
 * Handle client approval or question submission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { action, question } = body

    if (!action || !['approve', 'question'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const budgetQuote = await prisma.budgetQuote.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        org: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      }
    })

    if (!budgetQuote) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    // Check if already approved
    if (budgetQuote.clientApproved) {
      return NextResponse.json({ error: 'Budget already approved' }, { status: 400 })
    }

    const clientName = budgetQuote.clientEmail?.split('@')[0] || 'Client'

    if (action === 'approve') {
      // Update budget quote as approved
      await prisma.budgetQuote.update({
        where: { token },
        data: {
          status: 'APPROVED',
          clientApproved: true,
          clientApprovedAt: new Date()
        }
      })

      // Update all items to BUDGET_APPROVED status
      if (budgetQuote.itemIds.length > 0) {
        await prisma.roomFFEItem.updateMany({
          where: {
            id: { in: budgetQuote.itemIds }
          },
          data: {
            status: 'BUDGET_APPROVED',
            clientApproved: true,
            clientApprovedAt: new Date()
          }
        })
      }

      // Send notification email
      try {
        const emailHtml = generateBudgetApprovalNotificationEmail({
          budgetQuoteNumber: `BQ-${budgetQuote.id.slice(-6).toUpperCase()}`,
          clientName,
          clientEmail: budgetQuote.clientEmail || 'Unknown',
          projectName: budgetQuote.project.name,
          companyName: budgetQuote.org.name,
          title: budgetQuote.title,
          itemCount: budgetQuote.itemIds.length,
          estimatedTotal: parseFloat(budgetQuote.estimatedTotal.toString()),
          approvedAt: new Date()
        })

        await sendEmail({
          to: NOTIFICATION_EMAIL,
          subject: `Budget Approved: ${budgetQuote.title} - ${budgetQuote.project.name}`,
          html: emailHtml
        })
      } catch (emailError) {
        console.error('Failed to send approval notification:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({ success: true, message: 'Budget approved successfully' })

    } else if (action === 'question') {
      if (!question?.trim()) {
        return NextResponse.json({ error: 'Question is required' }, { status: 400 })
      }

      // Update budget quote with question
      await prisma.budgetQuote.update({
        where: { token },
        data: {
          status: 'QUESTION_ASKED',
          clientQuestion: question.trim()
        }
      })

      // Send notification email
      try {
        const emailHtml = generateBudgetQuestionNotificationEmail({
          budgetQuoteNumber: `BQ-${budgetQuote.id.slice(-6).toUpperCase()}`,
          clientName,
          clientEmail: budgetQuote.clientEmail || 'Unknown',
          projectName: budgetQuote.project.name,
          companyName: budgetQuote.org.name,
          title: budgetQuote.title,
          question: question.trim()
        })

        await sendEmail({
          to: NOTIFICATION_EMAIL,
          subject: `Question on Budget: ${budgetQuote.title} - ${budgetQuote.project.name}`,
          html: emailHtml
        })
      } catch (emailError) {
        console.error('Failed to send question notification:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({ success: true, message: 'Question submitted successfully' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error processing budget quote response:', error)
    return NextResponse.json(
      { error: 'Failed to process response' },
      { status: 500 }
    )
  }
}
