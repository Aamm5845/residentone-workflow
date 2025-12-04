import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { DropboxService } from '@/lib/dropbox-service'

// Source category configurations
const SOURCE_CATEGORIES = {
  EXISTING_MEASUREMENTS: {
    label: 'Existing Measurements',
    folder: 'Existing',
    description: 'Site measurements, existing plans, surveys'
  },
  ARCHITECT_PLANS: {
    label: 'Architect Plans',
    folder: 'Architect Plans',
    description: 'CAD files, architect drawings, blueprints'
  },
  REFERENCE_IMAGES: {
    label: 'Reference Images',
    folder: 'Reference Images',
    description: 'Inspiration photos, style references'
  },
  CLIENT_NOTES: {
    label: 'Client Notes',
    folder: 'Client Notes',
    description: 'Requirements, preferences, meeting notes'
  },
  PROPOSALS: {
    label: 'Proposals',
    folder: 'Proposals',
    description: 'Project proposals, quotes, estimates'
  },
  CONTRACTS: {
    label: 'Contracts',
    folder: 'Contracts',
    description: 'Signed contracts, agreements, terms'
  },
  COMMUNICATION: {
    label: 'Communication',
    folder: 'Communication',
    description: 'Email threads, messages, correspondence'
  },
  OTHER: {
    label: 'Other Files',
    folder: 'Other',
    description: 'Miscellaneous client files'
  }
}

// GET - Fetch all sources for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      },
      select: {
        id: true,
        name: true,
        dropboxFolder: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch all sources for this project
    const sources = await prisma.projectSource.findMany({
      where: { projectId },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Group sources by category
    const groupedSources = Object.entries(SOURCE_CATEGORIES).map(([key, config]) => ({
      category: key,
      ...config,
      files: sources.filter(s => s.category === key)
    }))

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        dropboxFolder: project.dropboxFolder
      },
      categories: groupedSources,
      totalFiles: sources.length
    })

  } catch (error) {
    console.error('[sources] Error fetching sources:', error)
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
  }
}

// POST - Upload a new source file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const formData = await request.formData()
    
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!category || !SOURCE_CATEGORIES[category as keyof typeof SOURCE_CATEGORIES]) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      },
      select: {
        id: true,
        name: true,
        dropboxFolder: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Create Dropbox path
    const categoryConfig = SOURCE_CATEGORIES[category as keyof typeof SOURCE_CATEGORIES]
    const basePath = project.dropboxFolder || `/Projects/${project.name}`
    const sourcesPath = `${basePath}/7- SOURCES/${categoryConfig.folder}`
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const dropboxPath = `${sourcesPath}/${fileName}`

    // Upload to Dropbox
    const dropboxService = new DropboxService()
    
    try {
      // Ensure folder structure exists
      await dropboxService.createFolder(`${basePath}/7- SOURCES`)
      await dropboxService.createFolder(sourcesPath)
    } catch (folderError) {
      console.log('[sources] Folders already exist or created')
    }

    const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
    const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)

    // Save to database
    const source = await prisma.projectSource.create({
      data: {
        projectId,
        category: category as any,
        title: title || file.name,
        description,
        dropboxPath: uploadResult.path_display,
        dropboxUrl: sharedLink,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      source
    })

  } catch (error) {
    console.error('[sources] Error uploading source:', error)
    return NextResponse.json({ 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Remove a source file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID required' }, { status: 400 })
    }

    // Verify access and get source
    const source = await prisma.projectSource.findFirst({
      where: {
        id: sourceId,
        projectId,
        project: {
          orgId: session.user.orgId
        }
      }
    })

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    // Optionally delete from Dropbox
    if (source.dropboxPath) {
      try {
        const dropboxService = new DropboxService()
        await dropboxService.deleteFile(source.dropboxPath)
      } catch (dropboxError) {
        console.error('[sources] Failed to delete from Dropbox:', dropboxError)
        // Continue anyway - file might already be deleted
      }
    }

    // Delete from database
    await prisma.projectSource.delete({
      where: { id: sourceId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[sources] Error deleting source:', error)
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  }
}

