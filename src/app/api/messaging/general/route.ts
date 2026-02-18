import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'
import { v4 as uuidv4 } from 'uuid'
import { DropboxService } from '@/lib/dropbox-service'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

// GET /api/messaging/general - Get general team chat messages
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = session.user.orgId

    // Get general chat messages
    const messages = await prisma.chatMessage.findMany({
      where: {
        chatType: 'GENERAL',
        orgId: orgId,
        isDeleted: false
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            image: true
          }
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 200 // Limit to last 200 messages
    })

    // Group reactions by emoji for each message
    const messagesWithGroupedReactions = messages.map(msg => {
      const groupedReactions = msg.reactions.reduce((acc, reaction) => {
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

      return {
        ...msg,
        reactions: Object.values(groupedReactions)
      }
    })

    return NextResponse.json({
      success: true,
      messages: messagesWithGroupedReactions
    })

  } catch (error) {
    console.error('Error fetching general chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messaging/general - Send a message to general team chat
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = session.user.orgId
    const contentType = request.headers.get('content-type') || ''
    let content = ''
    let mentions: string[] = []
    let parentMessageId: string | null = null
    let imageUrl: string | null = null
    let imageFileName: string | null = null
    let attachments: any[] = []

    // Handle multipart form data (with files) or JSON (text only)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      content = (formData.get('content') as string) || ''
      const mentionsStr = formData.get('mentions') as string
      try {
        mentions = mentionsStr ? JSON.parse(mentionsStr) : []
        if (!Array.isArray(mentions)) mentions = []
      } catch {
        mentions = []
      }
      const parentIdStr = formData.get('parentMessageId') as string
      parentMessageId = parentIdStr || null
      
      // Get all uploaded files
      const files: File[] = []
      const fileKeys = Array.from(formData.keys()).filter(key => key.startsWith('file'))
      for (const key of fileKeys) {
        const file = formData.get(key) as File | null
        if (file) files.push(file)
      }
      
      if (files.length > 0) {
        // Validate and upload files
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
        const maxFileSize = 10 * 1024 * 1024

        for (const file of files) {
          if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ 
              error: `Invalid file type: ${file.name}` 
            }, { status: 400 })
          }
          
          if (file.size > maxFileSize) {
            return NextResponse.json({ 
              error: `File too large: ${file.name}` 
            }, { status: 400 })
          }
        }

        try {
          const dropboxService = new DropboxService()
          const basePath = `/Meisner Interiors Team Folder/11- SOFTWARE UPLOADS`
          const chatFolder = `${basePath}/Chat Attachments`
          
          try {
            await dropboxService.createFolder(basePath)
            await dropboxService.createFolder(chatFolder)
          } catch (folderError) {
            // Folders may already exist
          }
          
          for (const file of files) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const fileExtension = file.name.split('.').pop() || 'file'
            const uniqueFileName = `general_${uuidv4()}.${fileExtension}`
            const dropboxPath = `${chatFolder}/${uniqueFileName}`
            
            const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
            const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)
            
            if (!sharedLink) {
              throw new Error(`Failed to create shared link for ${file.name}`)
            }
            
            attachments.push({
              id: uuidv4(),
              name: file.name,
              url: sharedLink,
              type: file.type,
              size: file.size
            })
            
            if (!imageUrl && file.type.startsWith('image/')) {
              imageUrl = sharedLink
              imageFileName = file.name
            }
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError)
          return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 })
        }
      }
    } else {
      const data = await request.json()
      content = data.content || ''
      mentions = data.mentions || []
      parentMessageId = data.parentMessageId || null
    }

    if (!content.trim() && attachments.length === 0) {
      return NextResponse.json({ 
        error: 'Message content or attachments required' 
      }, { status: 400 })
    }

    // Create the chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        content: content.trim() || (attachments.length > 0 ? '(Attachment)' : ''),
        authorId: session.user.id,
        orgId: orgId,
        chatType: 'GENERAL',
        parentMessageId,
        imageUrl,
        imageFileName,
        attachments: attachments.length > 0 ? attachments : null
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            image: true
          }
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Create mentions if any
    const mentionRecords = []
    if (mentions.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          orgId: orgId
        },
        select: { 
          id: true, 
          name: true,
          email: true,
          emailNotificationsEnabled: true,
          phoneNumber: true,
          smsNotificationsEnabled: true
        }
      })

      if (validUsers.length > 0) {
        const mentionData = validUsers.map(user => ({
          messageId: chatMessage.id,
          mentionedId: user.id
        }))

        await prisma.chatMention.createMany({
          data: mentionData
        })

        // Create notifications for mentioned users
        const notificationData = validUsers.map(user => ({
          userId: user.id,
          type: 'MENTION' as const,
          title: `${session.user.name} mentioned you`,
          message: `You were mentioned in Team Chat: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          relatedId: chatMessage.id,
          relatedType: 'MESSAGE'
        }))

        await prisma.notification.createMany({
          data: notificationData
        })

        const fullMentions = await prisma.chatMention.findMany({
          where: { messageId: chatMessage.id },
          include: {
            mentionedUser: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        })
        
        mentionRecords.push(...fullMentions)
      }
    }

    // Create in-app MESSAGE notifications for all other team members (not just mentioned)
    try {
      const nonMentionedTeamMembers = await prisma.user.findMany({
        where: {
          orgId: orgId,
          id: {
            not: session.user.id,
            notIn: mentions // Don't create MESSAGE notification for mentioned users (they already get MENTION)
          }
        },
        select: { id: true }
      })

      if (nonMentionedTeamMembers.length > 0) {
        const messageNotificationData = nonMentionedTeamMembers.map(user => ({
          userId: user.id,
          type: 'CHAT_MESSAGE' as const,
          title: `${session.user.name} sent a message`,
          message: `New message in Team Chat: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          relatedId: chatMessage.id,
          relatedType: 'MESSAGE'
        }))

        await prisma.notification.createMany({
          data: messageNotificationData
        })
      }
    } catch (notifError) {
      console.error('[Notifications] Failed to create message notifications:', notifError)
    }

    // Send email notifications to all other team members
    try {
      const allTeamMembersRaw = await prisma.user.findMany({
        where: {
          orgId: orgId,
          id: { not: session.user.id }, // Don't email the sender
          emailNotificationsEnabled: true
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      })
      const allTeamMembers = allTeamMembersRaw.filter(u => u.email)

      const mentionedIds = new Set(mentions)
      const authorName = session.user.name || 'A team member'
      const messagePreview = content.trim() || '(Image attached)'
      const teamChatUrl = `${getBaseUrl()}/messages`

      // Team members who were NOT mentioned get a general "new message" email
      const nonMentionedMembers = allTeamMembers.filter(u => !mentionedIds.has(u.id))

      if (nonMentionedMembers.length > 0) {
        console.log(`[Email] Sending general chat notification to ${nonMentionedMembers.length} team member(s)`)

        const emailPromises = nonMentionedMembers.map(async (user) => {
          try {
            await sendEmail({
              to: user.email!,
              subject: `${authorName} sent a message in Team Chat`,
              html: generateGeneralChatNotificationEmail({
                recipientName: user.name || 'Team Member',
                authorName,
                messageContent: messagePreview,
                chatUrl: teamChatUrl,
                hasImage: !!imageUrl
              }),
              text: `Hi ${user.name},\n\n${authorName} sent a message in Team Chat:\n\n"${messagePreview}"\n\nView the conversation: ${teamChatUrl}\n\nBest regards,\nThe Team`
            })
            console.log(`[Email] ✅ General chat email sent to ${user.name}`)
          } catch (error) {
            console.error(`[Email] ❌ Failed to send general chat email to ${user.name}:`, error)
          }
        })

        Promise.all(emailPromises).catch(err =>
          console.error('[Email] Some general chat email notifications failed:', err)
        )
      }

      // Mentioned users get a mention-specific email (same as before but now also for general chat)
      const mentionedMembers = allTeamMembers.filter(u => mentionedIds.has(u.id))
      if (mentionedMembers.length > 0) {
        console.log(`[Email] Sending mention notification to ${mentionedMembers.length} mentioned user(s)`)

        const mentionEmailPromises = mentionedMembers.map(async (user) => {
          try {
            await sendEmail({
              to: user.email!,
              subject: `${authorName} mentioned you in Team Chat`,
              html: generateGeneralChatNotificationEmail({
                recipientName: user.name || 'Team Member',
                authorName,
                messageContent: messagePreview,
                chatUrl: teamChatUrl,
                hasImage: !!imageUrl,
                isMention: true
              }),
              text: `Hi ${user.name},\n\n${authorName} mentioned you in Team Chat:\n\n"${messagePreview}"\n\nView the conversation: ${teamChatUrl}\n\nBest regards,\nThe Team`
            })
            console.log(`[Email] ✅ Mention email sent to ${user.name}`)
          } catch (error) {
            console.error(`[Email] ❌ Failed to send mention email to ${user.name}:`, error)
          }
        })

        Promise.all(mentionEmailPromises).catch(err =>
          console.error('[Email] Some mention email notifications failed:', err)
        )
      }
    } catch (emailError) {
      console.error('[Email] Failed to send general chat email notifications:', emailError)
    }

    // Log the activity
    await logActivity({
      session,
      action: 'CHAT_MESSAGE_SENT',
      entity: 'ORGANIZATION' as any,
      entityId: orgId!,
      details: {
        messageId: chatMessage.id,
        messagePreview: content.substring(0, 100),
        chatType: 'GENERAL',
        mentionsCount: mentionRecords.length
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: {
        ...chatMessage,
        mentions: mentionRecords,
        reactions: []
      }
    })

  } catch (error) {
    console.error('Error sending general chat message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate HTML email for general team chat notification
 */
function generateGeneralChatNotificationEmail({
  recipientName,
  authorName,
  messageContent,
  chatUrl,
  hasImage,
  isMention = false
}: {
  recipientName: string
  authorName: string
  messageContent: string
  chatUrl: string
  hasImage: boolean
  isMention?: boolean
}) {
  const title = isMention ? '💬 You were mentioned' : '💬 New Team Message'
  const subtitle = isMention
    ? `${authorName} mentioned you in Team Chat`
    : `${authorName} sent a message in Team Chat`

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Team Chat</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 32px; text-align: center;">
            <img src="${getBaseUrl()}/meisnerinteriorlogo.png"
                 alt="Meisner Interiors"
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;"
                 draggable="false" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">${title}</h1>
            <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 16px; font-weight: 400;">Team Chat</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${recipientName},</p>

            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${authorName}</strong> ${isMention ? 'mentioned you' : 'sent a message'} in <strong>Team Chat</strong>:
            </p>

            <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6; font-style: italic;">"${messageContent}"</p>
                ${hasImage ? '<p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">📎 Image attached</p>' : ''}
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${chatUrl}"
                   style="background: #3b82f6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);"
                   target="_blank">View Team Chat</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com"
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957"
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
}

