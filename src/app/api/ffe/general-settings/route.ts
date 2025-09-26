import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get general FFE settings for an organization and room type
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const roomType = searchParams.get('roomType')

    if (!orgId || !roomType) {
      return NextResponse.json({ error: 'Organization ID and room type are required' }, { status: 400 })
    }

    // Verify user has access to organization
    const org = await prisma.organization.findFirst({
      where: {
        id: orgId,
        users: {
          some: { id: session.user.id }
        }
      }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 })
    }

    // Get general settings for this room type
    const settings = await prisma.fFEGeneralSettings.findUnique({
      where: {
        orgId_roomType: { orgId, roomType }
      }
    })

    return NextResponse.json({ 
      settings: settings ? {
        roomType: settings.roomType,
        settings: settings.settings,
        updatedAt: settings.updatedAt.toISOString()
      } : null
    })

  } catch (error) {
    console.error('Error fetching FFE general settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update or create general FFE settings
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, roomType, itemId, settings } = body

    if (!orgId || !roomType || !itemId || !settings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to organization
    const org = await prisma.organization.findFirst({
      where: {
        id: orgId,
        users: {
          some: { id: session.user.id }
        }
      }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 })
    }

    // Get existing settings or create empty structure
    let existingSettings = await prisma.fFEGeneralSettings.findUnique({
      where: {
        orgId_roomType: { orgId, roomType }
      }
    })

    let currentSettings = existingSettings?.settings as any || {}
    
    // Update settings for this specific item
    currentSettings[itemId] = settings

    // Upsert the general settings
    const upsertedSettings = await prisma.fFEGeneralSettings.upsert({
      where: {
        orgId_roomType: { orgId, roomType }
      },
      update: {
        settings: currentSettings,
        updatedById: session.user.id
      },
      create: {
        orgId,
        roomType,
        settings: currentSettings,
        createdById: session.user.id,
        updatedById: session.user.id
      }
    })

    return NextResponse.json({ 
      success: true,
      settings: {
        roomType: upsertedSettings.roomType,
        settings: upsertedSettings.settings,
        updatedAt: upsertedSettings.updatedAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating FFE general settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Apply general settings to a new room
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, roomType, roomId } = body

    if (!orgId || !roomType || !roomId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to organization and room
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId,
          organization: {
            users: {
              some: { id: session.user.id }
            }
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found or access denied' }, { status: 404 })
    }

    // Get general settings for this room type
    const generalSettings = await prisma.fFEGeneralSettings.findUnique({
      where: {
        orgId_roomType: { orgId, roomType }
      }
    })

    if (!generalSettings || !generalSettings.settings) {
      return NextResponse.json({ 
        success: true,
        message: 'No general settings found to apply',
        appliedCount: 0
      })
    }

    const settings = generalSettings.settings as any
    let appliedCount = 0

    // Apply each item's settings to the room
    for (const [itemId, itemSettings] of Object.entries(settings)) {
      try {
        await prisma.fFEItemStatus.upsert({
          where: {
            roomId_itemId: { roomId, itemId }
          },
          update: {
            selectionType: (itemSettings as any).selectionType,
            customOptions: (itemSettings as any).customOptions || undefined,
            standardProduct: (itemSettings as any).standardProduct || undefined,
            updatedById: session.user.id
          },
          create: {
            roomId,
            itemId,
            state: 'pending', // Start as pending, user can confirm
            selectionType: (itemSettings as any).selectionType,
            customOptions: (itemSettings as any).customOptions || undefined,
            standardProduct: (itemSettings as any).standardProduct || undefined,
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
        appliedCount++
      } catch (error) {
        console.error(`Error applying settings for item ${itemId}:`, error)
        // Continue with other items even if one fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Applied general settings to ${appliedCount} items`,
      appliedCount
    })

  } catch (error) {
    console.error('Error applying FFE general settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}