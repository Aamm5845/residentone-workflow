import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { RoomType, ProjectType, StageType, StageStatus } from '@prisma/client'
import type { Session } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { orgId: session.user.orgId },
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
    
    if (!session?.user?.orgId) {
      console.log('❌ Unauthorized - no session or orgId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = session.user
    
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
    console.log('👤 Checking for existing client:', { email: clientEmail, orgId: session.user.orgId })
    
    let client = await prisma.client.findFirst({
      where: {
        email: clientEmail,
        orgId: session.user.orgId
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
          orgId: session.user.orgId
        }
      })
      console.log('✅ Client created successfully:', { id: client.id, name: client.name })
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found or created' }, { status: 400 })
    }

<<<<<<< HEAD
    // EMERGENCY FIX: Ultra-minimal project creation (Prisma schema/DB out of sync)
    console.log('🆘 EMERGENCY: Using ultra-minimal project creation due to schema mismatch')
    console.log('🔧 Issue: Prisma schema file has fields that don\'t exist in actual database')
    
    // Try with absolute bare minimum - just required fields
    const projectData = {
      name: name,
      type: type as ProjectType,
      clientId: client.id,
      orgId: session.user.orgId,
      createdById: session.user.id
      // Removed: description, status, budget, dueDate - adding back one by one if this works
    }
    
    console.log('📝 ULTRA-MINIMAL Project data (emergency fix):')
    console.log('   Fields being used:', Object.keys(projectData))
    console.log('   Full data:', JSON.stringify(projectData, null, 2))
    
    console.log('🚨 NOTE: This is a temporary fix - the following fields are missing from DB but exist in Prisma schema:')
    console.log('   - address (string?, optional)')
    console.log('   - coverImages (string[]?, optional)')
    console.log('   - description (optional - should work but removed for testing)')
    console.log('   - status (should work but removed for testing)')
    
    console.log('⚠️  CRITICAL: After this test, you MUST:')
    console.log('   1. Run: npx prisma generate (regenerate client)')
    console.log('   2. Run: npx prisma db push OR npx prisma migrate deploy (sync DB schema)')
    console.log('   3. Check what fields actually exist in your database')
    console.log('   4. Update this code to use proper fields once schema is synced')
    console.log('   5. Look for field "coverImageUrl" - this was mentioned in error but NOT in Prisma schema')
    
    // EMERGENCY: Direct SQL approach to bypass Prisma schema validation
    
    console.log('🚑 EMERGENCY: Switching to direct SQL to bypass Prisma validation')
    console.log('🔐 The error reveals a schema/DB mismatch - Prisma is looking for "coverImageUrl"')
    console.log('🗺️ The schema has "coverImages" (plural, JSON) but DB schema shows "address" exists')
    
    // Generate a CUID-like ID manually
    const randomId = `cuid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    let project
    try {
      console.log('🛠️ Attempting direct SQL INSERT to create project...')
      
      // Direct SQL INSERT to bypass Prisma validation
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Project" (
          "id", "name", "type", "status", 
          "clientId", "orgId", "createdById", 
          "createdAt", "updatedAt"
        ) VALUES (
          '${randomId}', '${projectData.name}', '${projectData.type}', 'DRAFT',
          '${projectData.clientId}', '${projectData.orgId}', '${projectData.createdById}',
          '${now}', '${now}'
        );
      `);
      
      console.log('✅ Project created successfully with direct SQL!')
      
      // Now fetch it with minimal fields to avoid validation issues
      project = await prisma.$queryRaw`
        SELECT "id", "name", "type", "status", "clientId", "orgId", "createdById", "createdAt", "updatedAt"
        FROM "Project"
        WHERE "id" = ${randomId}
      `;
      
      // Convert result to a single object (it comes as array with one item)
      project = Array.isArray(project) ? project[0] : project;
      
      console.log('✅ Project fetched:', { id: project.id, name: project.name })
    } catch (createError) {
      console.error('🚨 CRITICAL FAILURE: Even direct SQL failed')
      console.error('Error:', createError)
      
      // Last diagnostic - print ALL columns in the Project table
      try {
        console.log('🔍 Getting complete Project table schema...')
        const columns = await prisma.$queryRaw`
          SELECT column_name, data_type, column_default, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'Project'
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `;
        console.log('🗺️ COMPLETE Project schema:', columns)
      } catch (schemaError) {
        console.error('❌ Schema query failed:', schemaError)
      }
      
      throw createError;
    }
    
    console.log('✅ Project created successfully:', { id: project.id, name: project.name })
=======
    // Create project (temporarily removing address field due to schema sync issue)
    console.log('🏠 Creating project without address field (schema sync issue)')
    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        type: type as ProjectType,
        clientId: client.id,
        // address: projectAddress || null, // Temporarily disabled - schema sync issue
        budget: budget || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        coverImages: coverImages || [],
        orgId: session.user.orgId,
        createdById: session.user.id,
        status: 'IN_PROGRESS'
      }
    })
    
    console.log('✅ Project created successfully:', { projectId: project.id, name: project.name })
>>>>>>> 85c98c6f3fd80a226dac9dad5987e8bf1d188074

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

    // Get team members for stage assignments
    const teamMembers = await prisma.user.findMany({
      where: { orgId: session.user.orgId }
    })

    const designer = teamMembers.find(u => u.role === 'DESIGNER')
    const renderer = teamMembers.find(u => u.role === 'RENDERER') 
    const drafter = teamMembers.find(u => u.role === 'DRAFTER')
    const ffe = teamMembers.find(u => u.role === 'FFE')

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

      // Create all 6 workflow stages for each room
      const stages = [
        {
          roomId: room.id,
          type: 'DESIGN' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: designer?.id || null
        },
        {
          roomId: room.id,
          type: 'DESIGN_CONCEPT' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: designer?.id || null
        },
        {
          roomId: room.id,
          type: 'THREE_D' as StageType,
          status: 'NOT_STARTED' as StageStatus, 
          assignedTo: renderer?.id || null
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
          assignedTo: drafter?.id || null
        },
        {
          roomId: room.id,
          type: 'FFE' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: ffe?.id || null
        }
      ]

      await prisma.stage.createMany({
        data: stages
      })

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

    // Return the created project with full details (using raw SQL to avoid schema issues)
    console.log('📊 Fetching full project details with raw SQL...')
    
    // Fetch project with basic details using raw SQL to avoid schema mismatch
    const [projectDetails] = await prisma.$queryRaw`
      SELECT 
        p."id", p."name", p."description", p."type", p."status",
        p."clientId", p."orgId", p."createdById", p."createdAt", p."updatedAt",
        c."id" as "client_id", c."name" as "client_name", c."email" as "client_email", c."phone" as "client_phone"
      FROM "Project" p
      LEFT JOIN "Client" c ON p."clientId" = c."id"
      WHERE p."id" = ${project.id}
    `;
    
    // Fetch rooms and their stages separately
    const rooms = await prisma.$queryRaw`
      SELECT 
        r."id", r."projectId", r."type", r."name", r."status",
        r."createdAt", r."updatedAt"
      FROM "Room" r
      WHERE r."projectId" = ${project.id}
      ORDER BY r."createdAt"
    `;
    
    // Fetch stages for all rooms (handling empty rooms case)
    let stages = [];
    let ffeItems = [];
    
    if (Array.isArray(rooms) && rooms.length > 0) {
      const roomIds = rooms.map((r: any) => r.id);
      
      stages = await prisma.$queryRaw`
        SELECT 
          s."id", s."roomId", s."type", s."status", s."assignedTo",
          s."createdAt", s."updatedAt",
          u."id" as "user_id", u."name" as "user_name", u."email" as "user_email", u."role" as "user_role"
        FROM "Stage" s
        LEFT JOIN "User" u ON s."assignedTo" = u."id"
        WHERE s."roomId" = ANY(${roomIds})
        ORDER BY s."createdAt"
      `;
      
      // Fetch FFE items
      ffeItems = await prisma.$queryRaw`
        SELECT 
          f."id", f."roomId", f."name", f."category", f."status",
          f."createdAt", f."updatedAt"
        FROM "FFEItem" f
        WHERE f."roomId" = ANY(${roomIds})
        ORDER BY f."createdAt"
      `;
    }
    
    // Construct the response object manually (like Prisma include would)
    const fullProject = {
      ...projectDetails,
      client: {
        id: projectDetails.client_id,
        name: projectDetails.client_name,
        email: projectDetails.client_email,
        phone: projectDetails.client_phone
      },
      rooms: rooms.map((room: any) => ({
        ...room,
        stages: stages.filter((stage: any) => stage.roomId === room.id).map((stage: any) => ({
          id: stage.id,
          roomId: stage.roomId,
          type: stage.type,
          status: stage.status,
          assignedTo: stage.assignedTo,
          createdAt: stage.createdAt,
          updatedAt: stage.updatedAt,
          assignedUser: stage.user_id ? {
            id: stage.user_id,
            name: stage.user_name,
            email: stage.user_email,
            role: stage.user_role
          } : null
        })),
        ffeItems: ffeItems.filter((item: any) => item.roomId === room.id)
      }))
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
async function getDefaultFFEItems(roomType: RoomType) {
  const presets: Record<RoomType, Array<{ name: string, category: string }>> = {
    MASTER_BEDROOM: [
      { name: 'King Size Bed Frame', category: 'Furniture' },
      { name: 'Upholstered Headboard', category: 'Furniture' },
      { name: 'Nightstands (Set of 2)', category: 'Furniture' },
      { name: 'Table Lamps (Set of 2)', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' },
      { name: 'Dresser', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' }
    ],
    BEDROOM: [
      { name: 'Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    LIVING_ROOM: [
      { name: 'Sofa', category: 'Furniture' },
      { name: 'Lounge Chairs', category: 'Furniture' },
      { name: 'Coffee Table', category: 'Furniture' },
      { name: 'Side Tables', category: 'Furniture' },
      { name: 'Floor Lamps', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' },
      { name: 'Artwork', category: 'Accessories' }
    ],
    DINING_ROOM: [
      { name: 'Dining Table', category: 'Furniture' },
      { name: 'Dining Chairs', category: 'Furniture' },
      { name: 'Chandelier', category: 'Lighting' },
      { name: 'Sideboard', category: 'Furniture' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    KITCHEN: [
      { name: 'Cabinet Hardware', category: 'Hardware' },
      { name: 'Countertops', category: 'Finishes' },
      { name: 'Backsplash Tile', category: 'Finishes' },
      { name: 'Light Fixtures', category: 'Lighting' },
      { name: 'Bar Stools', category: 'Furniture' }
    ],
    BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' },
      { name: 'Shower Fixtures', category: 'Plumbing' }
    ],
    POWDER_ROOM: [
      { name: 'Powder Room Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Wallcovering', category: 'Finishes' }
    ],
    OFFICE: [
      { name: 'Desk', category: 'Furniture' },
      { name: 'Office Chair', category: 'Furniture' },
      { name: 'Desk Lamp', category: 'Lighting' },
      { name: 'Storage Units', category: 'Furniture' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
    // Entry & Circulation
    ENTRANCE: [
      { name: 'Entry Console Table', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Entry Mirror', category: 'Accessories' },
      { name: 'Entry Rug', category: 'Accessories' }
    ],
    FOYER: [
      { name: 'Chandelier', category: 'Lighting' },
      { name: 'Console Table', category: 'Furniture' },
      { name: 'Decorative Objects', category: 'Accessories' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
    STAIRCASE: [
      { name: 'Stair Runner', category: 'Textiles' },
      { name: 'Wall Sconces', category: 'Lighting' },
      { name: 'Handrail Finishes', category: 'Hardware' }
    ],
    
    // Living Spaces
    STUDY_ROOM: [
      { name: 'Study Desk', category: 'Furniture' },
      { name: 'Desk Chair', category: 'Furniture' },
      { name: 'Bookshelves', category: 'Furniture' },
      { name: 'Desk Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
    PLAYROOM: [
      { name: 'Storage Cubes', category: 'Furniture' },
      { name: 'Play Table & Chairs', category: 'Furniture' },
      { name: 'Toy Storage', category: 'Furniture' },
      { name: 'Ceiling Light', category: 'Lighting' },
      { name: 'Soft Play Rug', category: 'Accessories' }
    ],
    
    // Bedrooms
    GIRLS_ROOM: [
      { name: 'Twin/Full Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Dresser', category: 'Furniture' },
      { name: 'Desk & Chair', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    BOYS_ROOM: [
      { name: 'Twin/Full Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Dresser', category: 'Furniture' },
      { name: 'Desk & Chair', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    GUEST_BEDROOM: [
      { name: 'Queen Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstands (Set of 2)', category: 'Furniture' },
      { name: 'Table Lamps', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    
    // Bathrooms
    MASTER_BATHROOM: [
      { name: 'Double Vanity', category: 'Furniture' },
      { name: 'Vanity Mirrors (Set of 2)', category: 'Accessories' },
      { name: 'Vanity Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware Package', category: 'Hardware' },
      { name: 'Shower Fixtures', category: 'Plumbing' },
      { name: 'Bathtub', category: 'Plumbing' }
    ],
    FAMILY_BATHROOM: [
      { name: 'Single Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Vanity Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware Package', category: 'Hardware' },
      { name: 'Tub/Shower Combo', category: 'Plumbing' }
    ],
    GIRLS_BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Fun Tile Selection', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' }
    ],
    BOYS_BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' }
    ],
    GUEST_BATHROOM: [
      { name: 'Powder Room Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' }
    ],
    
    // Utility
    LAUNDRY_ROOM: [
      { name: 'Utility Sink', category: 'Plumbing' },
      { name: 'Countertop', category: 'Finishes' },
      { name: 'Upper Cabinets', category: 'Furniture' },
      { name: 'Hardware', category: 'Hardware' },
      { name: 'Task Lighting', category: 'Lighting' }
    ],
    
    // Special
    SUKKAH: [
      { name: 'Structural Elements', category: 'Construction' },
      { name: 'Schach Materials', category: 'Construction' },
      { name: 'Decorations', category: 'Accessories' },
      { name: 'Seating', category: 'Furniture' },
      { name: 'Table', category: 'Furniture' }
    ],
    
    // Legacy room types (keep for compatibility)
    FAMILY_ROOM: [],
    HALLWAY: [],
    PANTRY: [],
    LAUNDRY: [],
    MUDROOM: [],
    CLOSET: [],
    OUTDOOR: [],
    OTHER: []
  }

  return presets[roomType] || []
}
