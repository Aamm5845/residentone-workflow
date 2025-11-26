import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { autoAssignPhasesToTeam } from '@/lib/utils/auto-assignment'
import { dropboxService } from '@/lib/dropbox-service'
import { generateProjectFolderName, sanitizeDropboxFolderName } from '@/lib/generate-project-folder-name'
import type { Session } from 'next-auth'
import { ProjectType, RoomType, StageType, StageStatus } from '@prisma/client'
import { logProjectActivity, ActivityActions, getIPAddress } from '@/lib/activity-logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: true
              }
            }
          }
        },
        _count: {
          select: { 
            rooms: true,
            assets: true,
            approvals: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    
    if (!session?.user) {
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get shared organization
    const sharedOrg = await prisma.organization.findFirst()
    if (!sharedOrg) {
      return NextResponse.json({ error: 'No shared organization found' }, { status: 500 })
    }
    
    const data = await request.json()

    const {
      name,
      description,
      type,
      status,
      clientName,
      clientEmail,
      clientPhone,
      projectAddress,
      streetAddress,
      city,
      province,
      postalCode,
      budget,
      dueDate,
      selectedRooms,
      coverImages,
      contractors,
      dropboxOption,
      dropboxFolderPath
    } = data

    // Find or create client (handle unique constraint on orgId + email)
    
    let client = await prisma.client.findFirst({
      where: {
        email: clientEmail,
        orgId: sharedOrg.id
      }
    })
    
    if (client) {
      
      // Update client info if provided (optional)
      if (clientName && client.name !== clientName) {
        
        client = await prisma.client.update({
          where: { id: client.id },
          data: { 
            name: clientName,
            phone: clientPhone || client.phone
          }
        })
      }
    } else {
      
      client = await prisma.client.create({
        data: {
          name: clientName,
          email: clientEmail,
          phone: clientPhone || null,
          orgId: sharedOrg.id
        }
      })
      
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found or created' }, { status: 400 })
    }

    // Handle Dropbox folder creation/linking
    let dropboxFolderResult: string | null = null
    let dropboxError: string | null = null
    
    if (dropboxOption === 'create') {
      try {
        // Generate formatted folder name: YYNNN - Address (Initial. LastName)
        const fullAddress = [streetAddress, city, province]
          .filter(Boolean)
          .join(', ')
        
        const folderName = await generateProjectFolderName(
          fullAddress || projectAddress || name,
          clientName,
          sharedOrg.id
        )
        
        const sanitizedFolderName = sanitizeDropboxFolderName(folderName)
        
        console.log('📁 Creating Dropbox folder structure:', sanitizedFolderName)
        dropboxFolderResult = await dropboxService.createProjectFolderStructure(sanitizedFolderName)
        console.log('✅ Dropbox folder created:', dropboxFolderResult)
      } catch (error) {
        console.error('❌ Failed to create Dropbox folder structure:', error)
        dropboxError = error instanceof Error ? error.message : 'Unknown error'
        // Don't fail project creation if Dropbox fails
      }
    } else if (dropboxOption === 'link' && dropboxFolderPath) {
      console.log('🔗 Linking project to existing Dropbox folder:', dropboxFolderPath)
      dropboxFolderResult = dropboxFolderPath
    } else if (dropboxOption === 'skip') {
      console.log('⏭️ Skipping Dropbox integration for project:', name)
    }

    // Create project with proper Prisma ORM (fixed to include coverImages)
    
    const projectData = {
      name: name,
      description: description || null,
      type: type as ProjectType,
      status: (status || 'DRAFT') as any,
      clientId: client.id,
      budget: budget ? parseFloat(budget) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      address: projectAddress || null,
      streetAddress: streetAddress || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      coverImages: coverImages && coverImages.length > 0 ? coverImages : null,
      dropboxFolder: dropboxFolderResult,
      // Enable project features by default (can be disabled in project settings)
      hasFloorplanApproval: true,
      hasSpecBook: true,
      hasProjectUpdates: true,
      orgId: sharedOrg.id,
      createdById: session.user.id
    }

    let project
    try {
      project = await prisma.project.create({
        data: projectData
      })

    } catch (createError) {
      console.error('❌ Failed to create project:', createError)
      return NextResponse.json({ 
        error: 'Failed to create project', 
        details: createError instanceof Error ? createError.message : 'Unknown error' 
      }, { status: 500 })
    }

    // Create project contractors relationships
    
    if (contractors && contractors.length > 0) {
      console.log('✅ Creating contractor relationships:', contractors.map(c => ({ id: c.id, type: c.type })))
      const projectContractors = contractors.map((contractor: any) => ({
        projectId: project.id,
        contractorId: contractor.id,
        role: contractor.type // Map 'type' to 'role' field in ProjectContractor
      }))
      
      await prisma.projectContractor.createMany({
        data: projectContractors
      })
      
    } else {
      
    }

    // Create rooms and stages
    for (const roomData of selectedRooms) {
      // Handle both old format (string) and new format (object)
      const roomType = typeof roomData === 'string' ? roomData : roomData.type
      const roomName = typeof roomData === 'string' ? null : (roomData.customName || roomData.name)
      
      const room = await prisma.room.create({
        data: {
          projectId: project.id,
          type: roomType as RoomType,
          name: roomName,
          status: 'NOT_STARTED'
        }
      })

      // Create all workflow stages for each room (without assignments)
      const stages = [
        {
          roomId: room.id,
          type: 'DESIGN' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: null // Will be assigned by auto-assignment
        },
        {
          roomId: room.id,
          type: 'DESIGN_CONCEPT' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: null
        },
        {
          roomId: room.id,
          type: 'THREE_D' as StageType,
          status: 'NOT_STARTED' as StageStatus, 
          assignedTo: null
        },
        {
          roomId: room.id,
          type: 'CLIENT_APPROVAL' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: null
        },
        {
          roomId: room.id,
          type: 'DRAWINGS' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: null
        },
        {
          roomId: room.id,
          type: 'FFE' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: null
        }
      ]

      await prisma.stage.createMany({
        data: stages
      })

      // Auto-assign stages to team members based on their roles
      try {
        const assignmentResult = await autoAssignPhasesToTeam(room.id, sharedOrg.id)
        
      } catch (assignmentError) {
        console.error('Failed to auto-assign phases to team:', assignmentError)
        // Don't fail room creation if assignment fails
      }

      // TODO: Create design sections for the design stage (temporarily disabled due to schema sync issues)
      // const designStage = await projectPrisma.stage.findFirst({
      //   where: { roomId: room.id, type: 'DESIGN' }
      // })

      // if (designStage) {
      //   await projectPrisma.designSection.createMany({
      //     data: [
      //       { stageId: designStage.id, type: 'WALLS' },
      //       { stageId: designStage.id, type: 'FURNITURE' },
      //       { stageId: designStage.id, type: 'LIGHTING' },
      //       { stageId: designStage.id, type: 'GENERAL' }
      //     ]
      //   })
      // }

      // Create default FFE items based on room type
      const defaultFFEItems = await getDefaultFFEItems(roomType as RoomType)
      if (defaultFFEItems.length > 0) {
        await prisma.fFEItem.createMany({
          data: defaultFFEItems.map(item => ({
            roomId: room.id,
            name: item.name,
            category: item.category,
            status: 'NOT_STARTED'
          }))
        })
      }
    }

    // Return the created project with full details using proper Prisma query
    
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: true
              }
            },
            ffeItems: true
          }
        }
      }
    })
    
    if (!fullProject) {
      return NextResponse.json({ error: 'Project not found after creation' }, { status: 500 })
    }

    // Log project creation activity
    try {
      await logProjectActivity(session, ActivityActions.PROJECT_CREATED, {
        projectId: fullProject.id,
        projectName: fullProject.name,
        clientName: client.name,
        entityUrl: `/projects/${fullProject.id}`,
        ipAddress: getIPAddress(request)
      })
    } catch (logError) {
      console.error('Failed to log project creation activity:', logError)
      // Don't fail the request if logging fails
    }

    // Return project with Dropbox status
    return NextResponse.json({
      ...fullProject,
      dropboxStatus: {
        success: dropboxOption === 'skip' || !!dropboxFolderResult,
        folderPath: dropboxFolderResult,
        error: dropboxError,
        option: dropboxOption
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to get default FFE items for room types
// REMOVED ALL HARDCODED DEFAULTS - Users now manage all FFE items themselves
async function getDefaultFFEItems(roomType: RoomType) {
  // Return empty array - no hardcoded defaults
  return []
}
