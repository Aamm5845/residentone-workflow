import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { prisma } from '@/lib/prisma'
import { DropboxService } from '@/lib/dropbox-service'
import { v4 as uuidv4 } from 'uuid'
import { sendEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/get-base-url'

// Generate email HTML for mention notifications
function generateMentionNotificationEmail({
  recipientName,
  authorName,
  projectName,
  messageContent,
  projectUrl,
  hasAttachment
}: {
  recipientName: string
  authorName: string
  projectName: string
  messageContent: string
  projectUrl: string
  hasAttachment: boolean
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You were mentioned - ${projectName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 32px; text-align: center;">
            <img src="${getBaseUrl()}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">💬 You were mentioned</h1>
            <p style="margin: 8px 0 0 0; color: #ddd6fe; font-size: 16px; font-weight: 400;">Floorplan Drawings • ${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${recipientName},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${authorName}</strong> mentioned you in the Floorplan Drawings chat:
            </p>
            
            <div style="background: #f1f5f9; border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6; font-style: italic;">"${messageContent}"</p>
                ${hasAttachment ? '<p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">📎 Attachment included</p>' : ''}
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${projectUrl}" 
                   style="background: #8b5cf6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);"
                   target="_blank">View Floorplan Drawings</a>
            </div>
            
            <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                You're receiving this because you were mentioned in a chat message.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #7c3aed; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #7c3aed; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
}

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
      // Get mentioned users' details for email notifications
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          NOT: { id: session.user.id } // Don't notify yourself
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      })

      const projectUrl = `${getBaseUrl()}/projects/${project.id}/floorplan/drawings`
      const messagePreview = content.length > 150 ? content.substring(0, 150) + '...' : content
      const authorName = session.user.name || 'A team member'

      for (const user of mentionedUsers) {
        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'MENTION',
            title: `${authorName} mentioned you`,
            message: `You were mentioned in the floorplan chat for ${project.name}`,
            link: `/projects/${project.id}/floorplan/drawings`,
            read: false
          }
        })

        // Send email notification (don't await to not block the response)
        if (user.email) {
          console.log(`[Floorplan Chat] Sending mention email to ${user.name} (${user.email})`)
          sendEmail({
            to: user.email,
            subject: `${authorName} mentioned you in Floorplan Drawings - ${project.name}`,
            html: generateMentionNotificationEmail({
              recipientName: user.name || 'Team Member',
              authorName,
              projectName: project.name,
              messageContent: messagePreview,
              projectUrl,
              hasAttachment: uploadedAttachments.length > 0
            }),
            text: `Hi ${user.name},\n\n${authorName} mentioned you in the Floorplan Drawings chat for ${project.name}:\n\n"${messagePreview}"\n\nView the floorplan: ${projectUrl}\n\nBest regards,\nMeisner Interiors Team`
          }).then(() => {
            console.log(`[Floorplan Chat] ✅ Email sent to ${user.email}`)
          }).catch((error) => {
            console.error(`[Floorplan Chat] ❌ Failed to send email to ${user.email}:`, error)
          })
        }
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
