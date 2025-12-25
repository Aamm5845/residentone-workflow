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
      mentions = mentionsStr ? JSON.parse(mentionsStr) : []
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

