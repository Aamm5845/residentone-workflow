import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const sectionId = formData.get('sectionId') as string

    if (!file || !sectionId) {
      return NextResponse.json({ error: 'File and sectionId are required' }, { status: 400 })
    }

    // Find the stage and verify access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        designSections: true,
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Find or create design section
    let designSection = stage.designSections?.find(section => section.type === sectionId)
    
    if (!designSection) {
      designSection = await prisma.designSection.create({
        data: {
          stageId: stage.id,
          type: sectionId as any,
          content: ''
        }
      })
    }

    // Generate unique filename
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'stages', resolvedParams.id)
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Write file to disk
    const filePath = join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    // Determine asset type
    let assetType = 'DOCUMENT'
    if (file.type.startsWith('image/')) {
      assetType = 'IMAGE'
    } else if (file.type === 'application/pdf') {
      assetType = 'PDF'
    }

    // Create asset record in database
    const asset = await prisma.asset.create({
      data: {
        title: file.name,
        filename: fileName,
        url: `/uploads/stages/${resolvedParams.id}/${fileName}`,
        type: assetType as any,
        size: file.size,
        mimeType: file.type,
        provider: 'local',
        uploadedBy: session.user.id,
        orgId: session.user.orgId,
        projectId: stage.room.project.id,
        roomId: stage.room.id,
        stageId: stage.id,
        sectionId: designSection.id
      }
    })

    // Get updated stage with all data
    const updatedStage = await prisma.stage.findUnique({
      where: { id: stage.id },
      include: {
        assignedUser: {
          select: { name: true }
        },
        designSections: {
          include: {
            assets: {
              orderBy: { createdAt: 'desc' }
            },
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            },
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            ffeItems: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      asset: asset,
      stage: updatedStage
    })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
