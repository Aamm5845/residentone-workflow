import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Helper to get user from API key or session
async function getAuthenticatedUser(request: NextRequest) {
  const apiKey = request.headers.get('X-Extension-Key')
  
  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            orgId: true,
            role: true
          }
        }
      }
    })
    
    if (token?.createdBy) {
      return token.createdBy
    }
  }
  
  const session = await getSession()
  
  if (!session?.user?.email) {
    return null
  }
  
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true
    }
  })
  
  return user
}

// POST: Save a clipped item to FFE
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }
    
    const body = await request.json()
    const { roomId, sectionId, item } = body
    
    // Validate required fields
    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }
    
    if (!sectionId) {
      return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })
    }
    
    if (!item?.name) {
      return NextResponse.json({ error: 'item.name is required' }, { status: 400 })
    }
    
    // Verify room belongs to user's organization
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: user.orgId
        }
      },
      include: {
        ffeInstance: true
      }
    })
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    // Create or get FFE instance for the room
    let ffeInstance = room.ffeInstance
    
    if (!ffeInstance) {
      ffeInstance = await prisma.roomFFEInstance.create({
        data: {
          roomId: room.id,
          name: `${room.name || room.type} FFE`,
          status: 'IN_PROGRESS',
          progress: 0,
          createdById: user.id,
          updatedById: user.id
        }
      })
    }
    
    // Handle section - could be existing ID or new section name
    let targetSectionId = sectionId
    
    // Check if sectionId starts with 'new_' or 'lib_' (indicating we need to create it)
    if (sectionId.startsWith('new_') || sectionId.startsWith('lib_')) {
      const sectionName = sectionId.startsWith('new_') 
        ? sectionId.replace('new_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : await getSectionNameFromLibrary(sectionId.replace('lib_', ''))
      
      // Get next order
      const existingSections = await prisma.roomFFESection.findMany({
        where: { instanceId: ffeInstance.id },
        orderBy: { order: 'desc' },
        take: 1
      })
      
      const nextOrder = existingSections.length > 0 ? existingSections[0].order + 1 : 1
      
      // Create the section
      const newSection = await prisma.roomFFESection.create({
        data: {
          instanceId: ffeInstance.id,
          name: sectionName,
          order: nextOrder,
          isExpanded: true,
          isCompleted: false
        }
      })
      
      targetSectionId = newSection.id
    } else {
      // Verify section exists and belongs to this room's instance
      const section = await prisma.roomFFESection.findFirst({
        where: {
          id: sectionId,
          instanceId: ffeInstance.id
        }
      })
      
      if (!section) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 })
      }
    }
    
    // Get next item order
    const existingItems = await prisma.roomFFEItem.findMany({
      where: { sectionId: targetSectionId },
      orderBy: { order: 'desc' },
      take: 1
    })
    
    const nextOrder = existingItems.length > 0 ? existingItems[0].order + 1 : 1
    
    // Create the FFE item
    const newItem = await prisma.roomFFEItem.create({
      data: {
        sectionId: targetSectionId,
        name: item.name,
        description: item.description || null,
        state: 'PENDING',
        visibility: 'VISIBLE',
        isRequired: false,
        isCustom: true,
        order: nextOrder,
        quantity: item.quantity || 1,
        unitCost: item.unitCost ? parseFloat(item.unitCost) : null,
        supplierName: item.supplierName || null,
        supplierLink: item.supplierLink || null,
        modelNumber: item.modelNumber || null,
        notes: item.notes || null,
        customFields: item.customFields || {},
        attachments: item.attachments || {},
        createdById: user.id,
        updatedById: user.id
      }
    })
    
    // Update FFE instance progress
    await updateFFEProgress(ffeInstance.id)
    
    return NextResponse.json({
      ok: true,
      item: {
        id: newItem.id,
        name: newItem.name,
        sectionId: targetSectionId
      },
      message: `Item "${item.name}" saved successfully`
    })
    
  } catch (error) {
    console.error('Extension clip error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper to get section name from library
async function getSectionNameFromLibrary(libraryId: string): Promise<string> {
  const librarySection = await prisma.fFESectionLibrary.findUnique({
    where: { id: libraryId },
    select: { name: true }
  })
  
  return librarySection?.name || 'Uncategorized'
}

// Helper to update FFE instance progress
async function updateFFEProgress(instanceId: string) {
  const items = await prisma.roomFFEItem.findMany({
    where: {
      section: {
        instanceId: instanceId
      },
      visibility: 'VISIBLE'
    },
    select: {
      state: true
    }
  })
  
  if (items.length === 0) {
    return
  }
  
  const completedCount = items.filter(i => 
    ['CONFIRMED', 'COMPLETED', 'NOT_NEEDED'].includes(i.state)
  ).length
  
  const progress = Math.round((completedCount / items.length) * 100)
  
  await prisma.roomFFEInstance.update({
    where: { id: instanceId },
    data: {
      progress: progress,
      status: progress === 100 ? 'COMPLETED' : 'IN_PROGRESS'
    }
  })
}
