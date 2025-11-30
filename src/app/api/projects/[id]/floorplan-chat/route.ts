import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { prisma } from '@/lib/prisma'
import { DropboxService } from '@/lib/dropbox-service'
import { v4 as uuidv4 } from 'uuid'

// GET - Fetch all messages for a floorplan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch messages for this floorplan project
    const messages = await prisma.floorplanChatMessage.findMany({
      where: {
        projectId: resolvedParams.id
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
          include: {
            author: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        attachments: true,
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

    // Transform reactions to group by emoji
    const transformedMessages = messages.map(msg => {
      const reactionMap = new Map<string, { emoji: string; count: number; users: any[]; userHasReacted: boolean }>()
      
      for (const reaction of msg.reactions) {
        const existing = reactionMap.get(reaction.emoji)
        if (existing) {
          existing.count++
          existing.users.push(reaction.user)
          if (reaction.userId === session.user.id) {
            existing.userHasReacted = true
          }
        } else {
          reactionMap.set(reaction.emoji, {
            emoji: reaction.emoji,
            count: 1,
            users: [reaction.user],
            userHasReacted: reaction.userId === session.user.id
          })
        }
      }

      return {
        ...msg,
        isEdited: msg.editedAt !== null,
        reactions: Array.from(reactionMap.values())
      }
    })

    return NextResponse.json({ messages: transformedMessages })
  } catch (error) {
    console.error('Error fetching floorplan chat messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST - Create a new message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''
    let content = ''
    let mentions: string[] = []
    let parentMessageId: string | null = null
    let imageUrl: string | null = null
    let imageFileName: string | null = null
    let uploadedAttachments: Array<{ name: string; url: string; type: string; size: number }> = []

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
          const chatFolder = `${basePath}/Floorplan Chat Attachments`
          try {
            await dropboxService.createFolder(basePath)
            await dropboxService.createFolder(chatFolder)
          } catch (folderError) {
            console.log('[floorplan-chat] Folders already exist or created successfully')
          }
          
          // Upload each file
          for (const file of files) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const fileExtension = file.name.split('.').pop() || 'file'
            const uniqueFileName = `floorplan_chat_${uuidv4()}.${fileExtension}`
            const dropboxPath = `${chatFolder}/${uniqueFileName}`
            
            const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
            const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)
            
            if (!sharedLink) {
              throw new Error(`Failed to create shared link for ${file.name}`)
            }
            
            // Store file metadata
            uploadedAttachments.push({
              name: file.name,
              url: sharedLink,
              type: file.type,
              size: file.size
            })
            
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
      parentMessageId = data.parentMessageId || null
    }

    if (!content?.trim() && uploadedAttachments.length === 0) {
      return NextResponse.json({ error: 'Content or attachments required' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create the message
    const message = await prisma.floorplanChatMessage.create({
      data: {
        projectId: resolvedParams.id,
        authorId: session.user.id,
        content: content.trim() || (uploadedAttachments.length > 0 ? '(Attachment)' : ''),
        parentMessageId: parentMessageId || null,
        imageUrl,
        imageFileName,
        mentions: {
          create: (mentions || []).map((userId: string) => ({
            mentionedUserId: userId
          }))
        }
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
          include: {
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
        }
      }
    })

    // Create attachments if we have uploaded files
    let attachments: any[] = []
    if (uploadedAttachments.length > 0) {
      // First create Asset records for each attachment
      for (const att of uploadedAttachments) {
        // Determine asset type from mime type
        let assetType: 'IMAGE' | 'PDF' | 'DOCUMENT' | 'OTHER' = 'OTHER'
        if (att.type.startsWith('image/')) {
          assetType = 'IMAGE'
        } else if (att.type === 'application/pdf') {
          assetType = 'PDF'
        } else if (att.type.includes('word') || att.type.includes('excel') || att.type.includes('spreadsheet')) {
          assetType = 'DOCUMENT'
        }

        const asset = await prisma.asset.create({
          data: {
            title: att.name,
            filename: att.name,
            url: att.url,
            type: assetType,
            size: att.size,
            mimeType: att.type,
            uploadedBy: session.user.id,
            orgId: session.user.orgId,
            projectId: resolvedParams.id
          }
        })

        const attachment = await prisma.floorplanChatAttachment.create({
          data: {
            messageId: message.id,
            assetId: asset.id,
            name: att.name,
            url: att.url,
            type: att.type,
            size: att.size
          }
        })

        attachments.push(attachment)
      }
    }

    // Send notifications for mentions
    if (mentions && mentions.length > 0) {
      for (const userId of mentions) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'MENTION',
            title: `${session.user.name} mentioned you`,
            message: `You were mentioned in the floorplan chat for ${project.name}`,
            link: `/projects/${project.id}/floorplan/drawings`,
            read: false
          }
        })
      }
    }

    return NextResponse.json({ 
      message: {
        ...message,
        isEdited: false,
        reactions: [],
        attachments
      }
    })
  } catch (error) {
    console.error('Error creating floorplan chat message:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}
