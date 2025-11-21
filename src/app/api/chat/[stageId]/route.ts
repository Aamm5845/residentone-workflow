import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution,
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'
import { getStageName } from '@/constants/workflow'
import { sendMentionSMS } from '@/lib/twilio'
import { v4 as uuidv4 } from 'uuid'
import { sendEmail } from '@/lib/email/email-service'
import { DropboxService } from '@/lib/dropbox-service'

// GET /api/chat/[stageId] - Get all chat messages for a stage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.stageId
      },
      include: {
        room: {
          include: {
            project: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Get chat messages with author info, mentions, reactions, and parent message
    const chatMessages = await prisma.chatMessage.findMany({
      where: {
        stageId: resolvedParams.stageId,
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
      }
    })

    // Group reactions by emoji for each message
    const messagesWithGroupedReactions = chatMessages.map(msg => {
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
      messages: messagesWithGroupedReactions,
      stage: {
        id: stage.id,
        type: stage.type,
        assignedUser: stage.assignedUser,
        room: {
          id: stage.room.id,
          name: stage.room.name,
          project: {
            id: stage.room.project.id,
            name: stage.room.project.name
          }
        }
      }
    })

  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/chat/[stageId] - Send a new chat message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''
    let content = ''
    let mentions: string[] = []
    let notifyAssignee = true // Default to notify
    let parentMessageId: string | null = null
    let imageUrl: string | null = null
    let imageFileName: string | null = null
    let attachments: any[] = []

    // Handle multipart form data (with files) or JSON (text only)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      content = (formData.get('content') as string) || ''
      const mentionsStr = formData.get('mentions') as string
      mentions = mentionsStr ? JSON.parse(mentionsStr) : []
      const notifyStr = formData.get('notifyAssignee') as string
      notifyAssignee = notifyStr !== null ? notifyStr === 'true' : true
      const parentIdStr = formData.get('parentMessageId') as string
      parentMessageId = parentIdStr || null
      
      // Get all uploaded files
      const files: File[] = []
      const fileKeys = Array.from(formData.keys()).filter(key => key.startsWith('file'))
      for (const key of fileKeys) {
        const file = formData.get(key) as File | null
        if (file) files.push(file)
      }
      
      // Also check for legacy 'image' field
      const imageFile = formData.get('image') as File | null
      if (imageFile) files.push(imageFile)
      
      if (files.length > 0) {
        // Validate files
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
        const maxFileSize = 10 * 1024 * 1024 // 10MB per file
        const maxTotalSize = 50 * 1024 * 1024 // 50MB total
        
        // Validate each file
        let totalSize = 0
        for (const file of files) {
          if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ 
              error: `Invalid file type: ${file.name}. Allowed types: images, PDFs, Word, Excel` 
            }, { status: 400 })
          }
          
          if (file.size > maxFileSize) {
            return NextResponse.json({ 
              error: `File too large: ${file.name}. Maximum size is 10MB per file.` 
            }, { status: 400 })
          }
          
          totalSize += file.size
        }
        
        if (totalSize > maxTotalSize) {
          return NextResponse.json({ 
            error: 'Total file size exceeds 50MB limit.' 
          }, { status: 400 })
        }

        // Upload files to Dropbox
        try {
          const dropboxService = new DropboxService()
          
          // Ensure folder structure exists
          const basePath = `/Meisner Interiors Team Folder/11- SOFTWARE UPLOADS`
          const chatFolder = `${basePath}/Chat Attachments`
          try {
            await dropboxService.createFolder(basePath)
            await dropboxService.createFolder(chatFolder)
          } catch (folderError) {
            console.log('[chat] Folders already exist or created successfully')
          }
          
          // Upload each file
          for (const file of files) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const fileExtension = file.name.split('.').pop() || 'file'
            const uniqueFileName = `chat_${uuidv4()}.${fileExtension}`
            const dropboxPath = `${chatFolder}/${uniqueFileName}`
            
            const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
            const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)
            
            if (!sharedLink) {
              throw new Error(`Failed to create shared link for ${file.name}`)
            }
            
            // Store file metadata
            const attachment = {
              id: uuidv4(),
              name: file.name,
              url: sharedLink,
              type: file.type,
              size: file.size
            }
            
            attachments.push(attachment)
            
            // For backward compatibility, set first image as imageUrl
            if (!imageUrl && file.type.startsWith('image/')) {
              imageUrl = sharedLink
              imageFileName = file.name
            }
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError)
          return NextResponse.json({ 
            error: 'Failed to upload files' 
          }, { status: 500 })
        }
      }
    } else {
      const data = await request.json()
      content = data.content || ''
      mentions = data.mentions || []
      notifyAssignee = data.notifyAssignee !== undefined ? data.notifyAssignee : true
      parentMessageId = data.parentMessageId || null
    }

    if (!content.trim() && attachments.length === 0) {
      return NextResponse.json({ 
        error: 'Message content or attachments are required' 
      }, { status: 400 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.stageId
      },
      include: {
        room: {
          include: {
            project: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Verify parent message exists if replying
    if (parentMessageId) {
      const parentMessage = await prisma.chatMessage.findFirst({
        where: {
          id: parentMessageId,
          stageId: resolvedParams.stageId,
          isDeleted: false
        }
      })
      
      if (!parentMessage) {
        return NextResponse.json({ 
          error: 'Parent message not found' 
        }, { status: 400 })
      }
    }

    // Create the chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        content: content.trim() || (attachments.length > 0 ? '(Attachment)' : ''),
        authorId: session.user.id,
        stageId: resolvedParams.stageId,
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
      // Validate mentioned users exist
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          orgId: { not: null } // Only active users
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

        const createdMentions = await prisma.chatMention.createMany({
          data: mentionData
        })

        // Create notifications for mentioned users
        const notificationData = validUsers.map(user => ({
          userId: user.id,
          type: 'MENTION' as const,
          title: `${session.user.name} mentioned you`,
          message: `You were mentioned in ${getStageName(stage.type)} - ${stage.room.name} (${stage.room.project.name}): ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          relatedId: resolvedParams.stageId,
          relatedType: 'STAGE'
        }))

        await prisma.notification.createMany({
          data: notificationData
        })

        // Send SMS notifications to mentioned users with SMS enabled
        const usersForSMS = validUsers.filter(user => user.phoneNumber && user.smsNotificationsEnabled)
        console.log(`[SMS] Found ${usersForSMS.length} user(s) eligible for SMS:`, 
          usersForSMS.map(u => ({ name: u.name, phone: u.phoneNumber })))
        
        const smsPromises = usersForSMS.map(async (user) => {
            try {
              console.log(`[SMS] Attempting to send to ${user.name} at ${user.phoneNumber}...`)
              await sendMentionSMS({
                to: user.phoneNumber!,
                mentionedBy: session.user.name || 'Someone',
                stageName: getStageName(stage.type),
                projectName: stage.room.project.name,
                message: content.trim(),
                stageId: resolvedParams.stageId
              })
              console.log(`[SMS] ✅ Successfully sent to ${user.name} at ${user.phoneNumber}`)
              
              // Track this SMS conversation for reply routing
              const existingConvo = await prisma.smsConversation.findFirst({
                where: {
                  userId: user.id,
                  stageId: resolvedParams.stageId
                }
              })
              
              if (existingConvo) {
                await prisma.smsConversation.update({
                  where: { id: existingConvo.id },
                  data: { lastMessageAt: new Date() }
                })
              } else {
                await prisma.smsConversation.create({
                  data: {
                    userId: user.id,
                    phoneNumber: user.phoneNumber!,
                    stageId: resolvedParams.stageId,
                    lastMessageAt: new Date()
                  }
                })
              }
            } catch (error) {
              console.error(`[SMS] ❌ Failed to send SMS to ${user.name}:`, error)
              // Don't fail the whole request if SMS fails
            }
          })
        
        // Send all SMS in parallel but don't wait for them
        Promise.all(smsPromises).catch(err => 
          console.error('[SMS] Some SMS notifications failed:', err)
        )

        // Send email notifications to mentioned users with email enabled
        const usersForEmail = validUsers.filter(user => 
          user.email && 
          user.emailNotificationsEnabled &&
          user.id !== session.user.id // Don't email yourself
        )
        
        if (usersForEmail.length > 0) {
          console.log(`[Email] Found ${usersForEmail.length} user(s) eligible for mention email:`, 
            usersForEmail.map(u => ({ name: u.name, email: u.email })))
          
          const roomName = stage.room.name || stage.room.type.replace('_', ' ').toLowerCase()
          const projectName = stage.room.project.name
          const stageName = getStageName(stage.type)
          const authorName = session.user.name || 'A team member'
          const messagePreview = content.trim() || '(Image attached)'
          const roomUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/projects/${stage.room.project.id}/rooms/${stage.roomId}?stage=${resolvedParams.stageId}`
          
          const emailPromises = usersForEmail.map(async (user) => {
            try {
              console.log(`[Email] Attempting to send mention email to ${user.name} at ${user.email}...`)
              await sendEmail({
                to: user.email,
                subject: `${authorName} mentioned you in ${stageName} - ${roomName} (${projectName})`,
                html: generateChatNotificationEmail({
                  recipientName: user.name,
                  authorName,
                  stageName,
                  roomName,
                  projectName,
                  messageContent: messagePreview,
                  projectUrl: roomUrl,
                  hasImage: !!imageUrl
                }),
                text: `Hi ${user.name},\n\n${authorName} mentioned you in ${stageName} for ${roomName} (${projectName}):\n\n"${messagePreview}"\n\nView the room: ${roomUrl}\n\nBest regards,\nThe Team`
              })
              console.log(`[Email] ✅ Successfully sent mention email to ${user.name} at ${user.email}`)
            } catch (error) {
              console.error(`[Email] ❌ Failed to send mention email to ${user.name}:`, error)
              // Don't fail the whole request if email fails
            }
          })
          
          // Send all emails in parallel but don't wait for them
          Promise.all(emailPromises).catch(err => 
            console.error('[Email] Some mention email notifications failed:', err)
          )
        } else {
          console.log('[Email] No users eligible for mention email notifications')
        }

        // Get the created mentions for response
        const fullMentions = await prisma.chatMention.findMany({
          where: {
            messageId: chatMessage.id
          },
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

    // Send notifications to assigned team member if requested
    if (notifyAssignee && stage.assignedUser && stage.assignedUser.id !== session.user.id) {
      try {
        // Get full user details including notification preferences
        const assignedUserDetails = await prisma.user.findUnique({
          where: { id: stage.assignedUser.id },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            emailNotificationsEnabled: true,
            smsNotificationsEnabled: true
          }
        })

        if (assignedUserDetails) {
          const roomName = stage.room.name || stage.room.type.replace('_', ' ').toLowerCase()
          const projectName = stage.room.project.name
          const stageName = getStageName(stage.type)
          const authorName = session.user.name || 'A team member'
          const messagePreview = content.trim() || '(Image attached)'
          const roomUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/projects/${stage.room.project.id}/rooms/${stage.roomId}?stage=${resolvedParams.stageId}`

          // Send email notification if enabled
          if (assignedUserDetails.emailNotificationsEnabled) {
            try {
              await sendEmail({
                to: assignedUserDetails.email,
                subject: `New message in ${stageName} - ${roomName} (${projectName})`,
                html: generateChatNotificationEmail({
                  recipientName: assignedUserDetails.name,
                  authorName,
                  stageName,
                  roomName,
                  projectName,
                  messageContent: messagePreview,
                  projectUrl: roomUrl,
                  hasImage: !!imageUrl
                }),
                text: `Hi ${assignedUserDetails.name},\n\n${authorName} sent a message in ${stageName} for ${roomName} (${projectName}):\n\n"${messagePreview}"\n\nView the room: ${roomUrl}\n\nBest regards,\nThe Team`
              })
              console.log(`[Chat Notification] Email sent to ${assignedUserDetails.name}`)
            } catch (emailError) {
              console.error('Failed to send chat notification email:', emailError)
            }
          } else {
            console.log(`[Chat Notification] Email skipped for ${assignedUserDetails.name} (disabled by preference)`)
          }

          // Send SMS notification if enabled
          if (assignedUserDetails.phoneNumber && assignedUserDetails.smsNotificationsEnabled) {
            try {
              await sendMentionSMS({
                to: assignedUserDetails.phoneNumber,
                mentionedBy: authorName,
                stageName,
                projectName,
                message: messagePreview,
                stageId: resolvedParams.stageId
              })
              console.log(`[Chat Notification] SMS sent to ${assignedUserDetails.name}`)
            } catch (smsError) {
              console.error('Failed to send chat notification SMS:', smsError)
            }
          }
        }
      } catch (notificationError) {
        console.error('Failed to send chat notifications:', notificationError)
        // Don't fail the request if notifications fail
      }
    }

    // Log the activity
    await logActivity({
      session,
      action: 'CHAT_MESSAGE_SENT',
      entity: EntityTypes.STAGE,
      entityId: resolvedParams.stageId,
      details: {
        messageId: chatMessage.id,
        messagePreview: content.substring(0, 100),
        mentionsCount: mentionRecords.length,
        notifiedAssignee: notifyAssignee && stage.assignedUser && stage.assignedUser.id !== session.user.id,
        stageName: stage.type,
        roomName: stage.room.name || stage.room.type,
        projectName: stage.room.project.name,
        projectId: stage.room.project.id,
        entityUrl: `/projects/${stage.room.project.id}`
      },
      ipAddress
    })

    const responseMessage = {
      ...chatMessage,
      mentions: mentionRecords
    }

    return NextResponse.json({
      success: true,
      message: responseMessage
    })

  } catch (error) {
    console.error('Error sending chat message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate HTML email for chat notification
 */
function generateChatNotificationEmail({
  recipientName,
  authorName,
  stageName,
  roomName,
  projectName,
  messageContent,
  projectUrl,
  hasImage
}: {
  recipientName: string
  authorName: string
  stageName: string
  roomName: string
  projectName: string
  messageContent: string
  projectUrl: string
  hasImage: boolean
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Chat Message - ${projectName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 32px; text-align: center;">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" 
                 draggable="false" 
                 ondragstart="return false;" 
                 oncontextmenu="return false;"/>
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">💬 New Message</h1>
            <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 16px; font-weight: 400;">${roomName} • ${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${recipientName},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${authorName}</strong> sent a message in <strong>${stageName}</strong>:
            </p>
            
            <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6; font-style: italic;">"${messageContent}"</p>
                ${hasImage ? '<p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">📎 Image attached</p>' : ''}
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${projectUrl}" 
                   style="background: #3b82f6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);"
                   target="_blank">View Room</a>
            </div>
            
            <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                You're receiving this because you're assigned to the ${stageName} phase for this room.
            </p>
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
