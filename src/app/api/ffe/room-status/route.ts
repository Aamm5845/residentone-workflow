import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

// Enhanced FFE room status management
// Supports three-state logic: ✅ Included, 🚫 Not Needed, ⏳ Pending
// With Standard vs Custom configuration and conditional dependencies

interface FFEItemStatus {
  itemId: string
  state: 'pending' | 'included' | 'not_needed' | 'custom_expanded'
  selectionType?: 'standard' | 'custom'
  standardProduct?: {
    selectedOption: string
    notes?: string
  }
  customOptions?: Record<string, any>
  isCustomExpanded?: boolean
  notes?: string
  confirmedAt?: string
  updatedAt?: string
}

interface FFERoomStatus {
  roomId: string
  roomType: string
  items: Record<string, FFEItemStatus>
  completionPercentage: number
  lastUpdated: string
}

// GET: Load room FFE status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const orgId = searchParams.get('orgId')

    if (!roomId || !orgId) {
      return NextResponse.json(
        { error: 'Room ID and Organization ID are required' },
        { status: 400 }
      )
    }

    // Get the room to verify it exists and get room type
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: orgId
        }
      },
      include: {
        project: true
      }
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Get all FFE item statuses for this room
    const ffeStatuses = await prisma.fFEItemStatus.findMany({
      where: {
        roomId: roomId
      }
    })

    // Transform database records to our interface format
    const items: Record<string, FFEItemStatus> = {}
    
    ffeStatuses.forEach(status => {
      items[status.itemId] = {
        itemId: status.itemId,
        state: status.state as FFEItemStatus['state'],
        selectionType: status.selectionType as FFEItemStatus['selectionType'],
        standardProduct: status.standardProduct ? JSON.parse(status.standardProduct as string) : undefined,
        customOptions: status.customOptions ? JSON.parse(status.customOptions as string) : undefined,
        isCustomExpanded: status.isCustomExpanded,
        notes: status.notes || undefined,
        confirmedAt: status.confirmedAt?.toISOString(),
        updatedAt: status.updatedAt.toISOString()
      }
    })

    // Calculate completion percentage
    const totalItems = Object.keys(items).length
    const completedItems = Object.values(items).filter(
      item => item.state === 'included' || item.state === 'custom_expanded'
    ).length
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const roomStatus: FFERoomStatus = {
      roomId: room.id,
      roomType: room.type,
      items,
      completionPercentage,
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      status: roomStatus
    })

  } catch (error) {
    console.error('Error loading FFE room status:', error)
    return NextResponse.json(
      { error: 'Failed to load room status' },
      { status: 500 }
    )
  }
}

// POST: Save/update room FFE status
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { roomId, orgId, projectId, status } = body

    if (!roomId || !orgId || !status) {
      return NextResponse.json(
        { error: 'Room ID, Organization ID, and status are required' },
        { status: 400 }
      )
    }

    // Verify the room exists and user has access
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: orgId
        }
      }
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found or access denied' },
        { status: 404 }
      )
    }

    // Get current user for audit trail
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const roomStatus = status as FFERoomStatus

    // Save each item status
    const savePromises = Object.values(roomStatus.items).map(async (itemStatus) => {
      // Create audit log entry for changes
      const existingStatus = await prisma.fFEItemStatus.findUnique({
        where: {
          roomId_itemId: {
            roomId: roomId,
            itemId: itemStatus.itemId
          }
        }
      })

      // Prepare data for database
      const statusData = {
        roomId: roomId,
        itemId: itemStatus.itemId,
        state: itemStatus.state,
        selectionType: itemStatus.selectionType || null,
        isCustomExpanded: itemStatus.isCustomExpanded || false,
        subItemStates: itemStatus.customOptions ? JSON.stringify(itemStatus.customOptions) : null,
        customOptions: itemStatus.customOptions ? JSON.stringify(itemStatus.customOptions) : null,
        standardProduct: itemStatus.standardProduct ? JSON.stringify(itemStatus.standardProduct) : null,
        notes: itemStatus.notes || null,
        confirmedAt: itemStatus.state === 'included' || itemStatus.state === 'custom_expanded' 
          ? (itemStatus.confirmedAt ? new Date(itemStatus.confirmedAt) : new Date())
          : null,
        createdById: currentUser.id,
        updatedById: currentUser.id
      }

      // Upsert the status record
      const savedStatus = await prisma.fFEItemStatus.upsert({
        where: {
          roomId_itemId: {
            roomId: roomId,
            itemId: itemStatus.itemId
          }
        },
        update: {
          ...statusData,
          updatedById: currentUser.id,
          updatedAt: new Date()
        },
        create: {
          ...statusData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create audit log if there were changes
      if (existingStatus && existingStatus.state !== itemStatus.state) {
        await prisma.fFEAuditLog.create({
          data: {
            roomId: roomId,
            itemId: itemStatus.itemId,
            action: 'STATE_CHANGE',
            oldValue: existingStatus.state,
            newValue: itemStatus.state,
            notes: `Changed from ${existingStatus.state} to ${itemStatus.state}`,
            userId: currentUser.id
          }
        })
      }

      return savedStatus
    })

    await Promise.all(savePromises)

    // Update room progress percentage
    await prisma.room.update({
      where: { id: roomId },
      data: {
        progressFFE: roomStatus.completionPercentage,
        updatedById: currentUser.id,
        updatedAt: new Date()
      }
    })

    // Update general settings for the organization (for future projects)
    // This helps with consistency across projects
    await updateGeneralSettings(orgId, room.type, roomStatus, currentUser.id)

    return NextResponse.json({
      success: true,
      message: 'FFE status saved successfully',
      completionPercentage: roomStatus.completionPercentage
    })

  } catch (error) {
    console.error('Error saving FFE room status:', error)
    return NextResponse.json(
      { error: 'Failed to save room status' },
      { status: 500 }
    )
  }
}

// Helper function to update general settings for organization
async function updateGeneralSettings(orgId: string, roomType: string, roomStatus: FFERoomStatus, userId: string) {
  try {
    // Extract configuration patterns from completed items
    const confirmedItems = Object.values(roomStatus.items).filter(
      item => item.state === 'included' || item.state === 'custom_expanded'
    )

    if (confirmedItems.length === 0) return

    // Build general settings based on current selections
    const generalSettings = {
      roomType: roomType,
      defaultSelections: {} as Record<string, any>,
      customConfigurations: {} as Record<string, any>,
      lastUpdated: new Date().toISOString()
    }

    confirmedItems.forEach(item => {
      if (item.selectionType === 'standard' && item.standardProduct) {
        generalSettings.defaultSelections[item.itemId] = {
          type: 'standard',
          selection: item.standardProduct.selectedOption
        }
      } else if (item.selectionType === 'custom' && item.customOptions) {
        generalSettings.customConfigurations[item.itemId] = {
          type: 'custom',
          options: item.customOptions
        }
      }
    })

    // Save or update general settings
    await prisma.fFEGeneralSettings.upsert({
      where: {
        orgId_roomType: {
          orgId: orgId,
          roomType: roomType
        }
      },
      update: {
        settings: JSON.stringify(generalSettings),
        updatedById: userId,
        updatedAt: new Date()
      },
      create: {
        orgId: orgId,
        roomType: roomType,
        settings: JSON.stringify(generalSettings),
        createdById: userId,
        updatedById: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

  } catch (error) {
    console.error('Error updating general settings:', error)
    // Don't fail the main operation if general settings update fails
  }
}
