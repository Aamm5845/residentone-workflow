import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { autoAssignPhasesToTeam } from '@/lib/utils/auto-assignment'
import type { Session } from 'next-auth'
import { ProjectType, RoomType, StageType, StageStatus } from '@prisma/client'

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
    console.log('🚀 POST /api/projects - Starting project creation')
    
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    
    if (!session?.user) {
      console.log('❌ Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get shared organization
    const sharedOrg = await prisma.organization.findFirst()
    if (!sharedOrg) {
      return NextResponse.json({ error: 'No shared organization found' }, { status: 500 })
    }
    
    const data = await request.json()
    console.log('📝 Request data received:', { 
      name: data.name, 
      contractorsCount: data.contractors?.length || 0,
      roomsCount: data.selectedRooms?.length || 0,
      hasAddress: !!data.projectAddress,
      hasCoverImages: !!data.coverImages
    })
    
    console.log('📊 Available database fields based on error:')
    console.log('   ✅ name, description, type, clientId, budget, dueDate')
    console.log('   ✅ orgId, createdById, status, id, updatedById')
    console.log('   ✅ coverImageUrl (singular), dropboxFolder')
    console.log('   ✅ createdAt, updatedAt')
    console.log('   ❌ address (not available)')
    console.log('   ❌ coverImages (not available - use coverImageUrl instead)')
    
    const {
      name,
      description,
      type,
      clientName,
      clientEmail,
      clientPhone,
      projectAddress,
      budget,
      dueDate,
      selectedRooms,
      coverImages,
      contractors
    } = data

    // Find or create client (handle unique constraint on orgId + email)
    console.log('👤 Checking for existing client:', { email: clientEmail, orgId: sharedOrg.id })
    
    let client = await prisma.client.findFirst({
      where: {
        email: clientEmail,
        orgId: sharedOrg.id
      }
    })
    
    if (client) {
      console.log('✅ Found existing client:', { id: client.id, name: client.name, email: client.email })
      // Update client info if provided (optional)
      if (clientName && client.name !== clientName) {
        console.log('📝 Updating existing client name:', { from: client.name, to: clientName })
        client = await prisma.client.update({
          where: { id: client.id },
          data: { 
            name: clientName,
            phone: clientPhone || client.phone
          }
        })
      }
    } else {
      console.log('➕ Creating new client:', { name: clientName, email: clientEmail })
      client = await prisma.client.create({
        data: {
          name: clientName,
          email: clientEmail,
          phone: clientPhone || null,
          orgId: sharedOrg.id
        }
      })
      console.log('✅ Client created successfully:', { id: client.id, name: client.name })
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found or created' }, { status: 400 })
    }

    // Create project with proper Prisma ORM (fixed to include coverImages)
    console.log('🚀 Creating project with all fields including coverImages')
    
    const projectData = {
      name: name,
      description: description || null,
      type: type as ProjectType,
      status: 'DRAFT' as const,
      clientId: client.id,
      budget: budget ? parseFloat(budget) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      address: projectAddress || null,
      coverImages: coverImages && coverImages.length > 0 ? coverImages : null,
      orgId: sharedOrg.id,
      createdById: session.user.id
    }
    
    console.log('📝 Creating project with data:', {
      name: projectData.name,
      hasCoverImages: !!projectData.coverImages,
      coverImagesCount: Array.isArray(projectData.coverImages) ? projectData.coverImages.length : 0,
      hasAddress: !!projectData.address,
      hasDescription: !!projectData.description
    })
    
    let project
    try {
      project = await prisma.project.create({
        data: projectData
      })
      
      console.log('✅ Project created successfully with coverImages!')
      console.log(`📸 Cover images saved: ${project.coverImages ? JSON.stringify(project.coverImages) : 'none'}`)
      
    } catch (createError) {
      console.error('❌ Failed to create project:', createError)
      return NextResponse.json({ 
        error: 'Failed to create project', 
        details: createError instanceof Error ? createError.message : 'Unknown error' 
      }, { status: 500 })
    }
    
    console.log('✅ Project created successfully:', { id: project.id, name: project.name })
    
    // Create project contractors relationships
    console.log('👷 Processing contractors:', { contractorsCount: contractors?.length || 0 })
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
      console.log('✅ Contractor relationships created successfully')
    } else {
      console.log('ℹ️ No contractors to process')
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
        console.log(`Auto-assigned ${assignmentResult.assignedCount} stages for room ${room.id}`)
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
    console.log('📊 Fetching full project details with coverImages...')
    
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

    console.log('🎉 Project creation completed successfully! Returning response with status 201')
    console.log('📦 Project details:', { id: fullProject?.id, name: fullProject?.name, roomsCount: fullProject?.rooms?.length })
    
    return NextResponse.json(fullProject, { status: 201 })
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
