import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAutoFixNotificationEmail } from '@/lib/email'

/**
 * Callback endpoint for GitHub Actions auto-fix workflow
 * Called when auto-fix completes (success or failure)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get('X-Webhook-Secret')
    if (webhookSecret !== process.env.APP_WEBHOOK_SECRET) {
      console.error('[Auto-Fix Callback] Invalid webhook secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { issueId, success, summary, analysis, commitUrl } = body

    if (!issueId) {
      return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })
    }

    console.log(`[Auto-Fix Callback] Issue ${issueId}: ${success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`[Auto-Fix Callback] Summary: ${summary}`)

    // Get the issue with reporter info
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        reporter: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!issue) {
      console.error(`[Auto-Fix Callback] Issue not found: ${issueId}`)
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Update issue with auto-fix result
    const updateData: any = {
      metadata: {
        ...(issue.metadata as object || {}),
        autoFix: {
          attempted: true,
          success,
          summary,
          analysis,
          commitUrl: commitUrl || null,
          timestamp: new Date().toISOString()
        }
      }
    }

    // If fix was successful, update status to IN_PROGRESS (not RESOLVED - needs verification)
    if (success) {
      updateData.status = 'IN_PROGRESS'
    }

    await prisma.issue.update({
      where: { id: issueId },
      data: updateData
    })

    // Add a comment about the auto-fix attempt
    const systemUser = await prisma.user.findFirst({
      where: { role: 'OWNER' }
    })

    if (systemUser) {
      await prisma.issueComment.create({
        data: {
          issueId,
          authorId: systemUser.id,
          content: success
            ? `**Auto-Fix Applied**\n\n${summary}\n\n${analysis ? `**Analysis:** ${analysis}\n\n` : ''}${commitUrl ? `[View Commit](${commitUrl})` : ''}\n\n_Please verify the fix and mark as resolved if working correctly._`
            : `**Auto-Fix Failed**\n\n${summary}\n\n${analysis || 'Manual review required.'}`
        }
      })
    }

    // Get all admins/owners to notify about git pull
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'OWNER'] }
      },
      select: { id: true, name: true, email: true }
    })

    // Send email notifications
    if (success) {
      // Notify admins to git pull
      await Promise.allSettled(
        admins.map(admin =>
          sendAutoFixNotificationEmail(
            admin.email,
            admin.name || 'Admin',
            issue.title,
            summary,
            analysis || '',
            commitUrl || '',
            true
          )
        )
      )

      // Notify reporter that fix is being tested
      if (issue.reporter?.email) {
        await sendAutoFixNotificationEmail(
          issue.reporter.email,
          issue.reporter.name || 'User',
          issue.title,
          summary,
          analysis || '',
          commitUrl || '',
          true,
          true // isReporter
        )
      }
    } else {
      // Notify admins about failed auto-fix
      await Promise.allSettled(
        admins.map(admin =>
          sendAutoFixNotificationEmail(
            admin.email,
            admin.name || 'Admin',
            issue.title,
            summary,
            analysis || 'Manual review required',
            '',
            false
          )
        )
      )

      // Also notify reporter about the failure
      if (issue.reporter?.email) {
        await sendAutoFixNotificationEmail(
          issue.reporter.email,
          issue.reporter.name || 'User',
          issue.title,
          summary,
          analysis || 'Manual review required',
          '',
          false,
          true // isReporter
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Auto-Fix Callback] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
