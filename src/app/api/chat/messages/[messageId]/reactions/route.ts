import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/email-service'
import { sendMentionSMS } from '@/lib/twilio'
import { getStageName } from '@/constants/workflow'
import { getBaseUrl } from '@/lib/get-base-url'

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10)
})

// POST /api/chat/messages/[messageId]/reactions - Add or toggle reaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params
    const body = await request.json()

    // Validate input
    const { emoji } = reactionSchema.parse(body)

    // Check if user has access to the message
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        stage: {
          OR: [
            { assignedTo: session.user.id },
            { room: { project: { organization: { users: { some: { id: session.user.id } } } } } }
          ]
        }
      },
      select: {
        id: true,
        authorId: true,
        content: true,
        stage: {
          select: {
            id: true,
            type: true,
            room: {
              select: {
                name: true,
                type: true,
                project: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.chatMessageReaction.findFirst({
      where: {
        messageId,
        userId: session.user.id,
        emoji
      }
    })

    if (existingReaction) {
      // Remove existing reaction (toggle off)
      await prisma.chatMessageReaction.delete({
        where: { id: existingReaction.id }
      })

      // Get updated reaction count
      const reactionCount = await prisma.chatMessageReaction.count({
        where: { messageId, emoji }
      })

      return NextResponse.json({ 
        success: true, 
        action: 'removed',
        emoji,
        count: reactionCount
      })
    } else {
      // Add new reaction
      const newReaction = await prisma.chatMessageReaction.create({
        data: {
          messageId,
          userId: session.user.id,
          emoji
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        }
      })

      // Notify message author if different from reactor
      if (message.authorId !== session.user.id) {
        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: message.authorId,
            type: 'MESSAGE_REACTION',
            title: 'Someone reacted to your message',
            message: `${session.user.name} reacted to your message with ${emoji}`,
            relatedId: messageId,
            relatedType: 'chat_message'
          }
        })

        // Get message author details for email/SMS
        const messageAuthor = await prisma.user.findUnique({
          where: { id: message.authorId },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            emailNotificationsEnabled: true,
            smsNotificationsEnabled: true
          }
        })

        if (messageAuthor) {
          const reactorName = session.user.name || 'Someone'
          const messagePreview = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')

          // Send email notification if enabled
          if (messageAuthor.emailNotificationsEnabled) {
            try {
              await sendEmail({
                to: messageAuthor.email,
                subject: `${emoji} ${reactorName} reacted to your message`,
                html: generateReactionEmailHTML({
                  recipientName: messageAuthor.name || 'Team Member',
                  reactorName,
                  emoji,
                  messageContent: messagePreview
                }),
                text: `Hi ${messageAuthor.name},\n\n${reactorName} reacted to your message with ${emoji}\n\n"${messagePreview}"\n\nBest regards,\nThe Team`
              })
              console.log(`[Reaction Email] Sent to ${messageAuthor.name}`)
            } catch (emailError) {
              console.error('Failed to send reaction email:', emailError)
            }
          }

          // Send SMS notification if enabled
          if (messageAuthor.phoneNumber && messageAuthor.smsNotificationsEnabled) {
            try {
              const stageName = getStageName(message.stage.type)
              const roomName = message.stage.room.name || message.stage.room.type.replace('_', ' ')
              const projectName = message.stage.room.project.name
              
              // Use Twilio directly for reaction-specific SMS (not a mention)
              const { default: twilio } = await import('twilio')
              const accountSid = process.env.TWILIO_ACCOUNT_SID
              const authToken = process.env.TWILIO_AUTH_TOKEN
              const fromNumber = process.env.TWILIO_PHONE_NUMBER

              if (accountSid && authToken && fromNumber) {
                const client = twilio(accountSid, authToken)
                
                const smsBody = `${reactorName} reacted ${emoji} to your message in ${stageName} - ${roomName} (${projectName}): "${messagePreview}"`
                
                await client.messages.create({
                  body: smsBody,
                  to: messageAuthor.phoneNumber,
                  from: fromNumber
                })
                
                console.log(`[Reaction SMS] Sent to ${messageAuthor.name}`)
              } else {
                console.log('[Reaction SMS] Twilio not configured, skipping SMS')
              }
            } catch (smsError) {
              console.error('Failed to send reaction SMS:', smsError)
            }
          }
        }
      }

      // Get updated reaction count
      const reactionCount = await prisma.chatMessageReaction.count({
        where: { messageId, emoji }
      })

      return NextResponse.json({ 
        success: true, 
        action: 'added',
        reaction: newReaction,
        count: reactionCount
      }, { status: 201 })
    }

  } catch (error) {
    console.error('Error handling reaction:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/chat/messages/[messageId]/reactions - Get message reactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params

    // Check if user has access to the message
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        stage: {
          OR: [
            { assignedTo: session.user.id },
            { room: { project: { organization: { users: { some: { id: session.user.id } } } } } }
          ]
        }
      },
      select: { id: true }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Get all reactions for the message
    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          userHasReacted: false
        }
      }
      acc[reaction.emoji].count++
      acc[reaction.emoji].users.push(reaction.user)
      if (reaction.userId === session.user.id) {
        acc[reaction.emoji].userHasReacted = true
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      reactions: Object.values(groupedReactions),
      totalReactions: reactions.length
    })

  } catch (error) {
    console.error('Error fetching reactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate HTML email for reaction notification
 */
function generateReactionEmailHTML({
  recipientName,
  reactorName,
  emoji,
  messageContent
}: {
  recipientName: string
  reactorName: string
  emoji: string
  messageContent: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message Reaction</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 32px; text-align: center;">
            <img src="${getBaseUrl()}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" 
                 draggable="false" 
                 ondragstart="return false;" 
                 oncontextmenu="return false;"/>
            <div style="font-size: 48px; margin-bottom: 16px;">${emoji}</div>
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Message Reaction</h1>
            <p style="margin: 8px 0 0 0; color: #ddd6fe; font-size: 16px; font-weight: 400;">${reactorName} reacted to your message</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${recipientName},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${reactorName}</strong> reacted to your message with ${emoji}
            </p>
            
            <div style="background: #f1f5f9; border-left: 4px solid #6366f1; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6; font-style: italic;">"${messageContent}"</p>
            </div>
            
            <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                You're receiving this because someone reacted to your message.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
}
