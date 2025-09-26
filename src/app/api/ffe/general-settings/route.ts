import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

// FFE General Settings API
// Manages organization-wide default settings that persist across projects
// Helps reduce setup time for similar rooms

// GET: Load general settings for organization and room type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const roomType = searchParams.get('roomType')

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Get general settings
    let settings = null
    if (roomType) {
      // Get settings for specific room type
      const generalSettings = await prisma.fFEGeneralSettings.findUnique({
        where: {
          orgId_roomType: {
            orgId: orgId,
            roomType: roomType
          }
        },
        include: {
          createdBy: {
            select: { name: true }
          },
          updatedBy: {
            select: { name: true }
          }
        }
      })

      if (generalSettings) {
        settings = {
          id: generalSettings.id,
          orgId: generalSettings.orgId,
          roomType: generalSettings.roomType,
          settings: JSON.parse(generalSettings.settings as string),
          createdAt: generalSettings.createdAt.toISOString(),
          updatedAt: generalSettings.updatedAt.toISOString(),
          createdBy: generalSettings.createdBy.name,
          updatedBy: generalSettings.updatedBy.name
        }
      }
    } else {
      // Get all settings for organization
      const allSettings = await prisma.fFEGeneralSettings.findMany({
        where: {
          orgId: orgId
        },
        include: {
          createdBy: {
            select: { name: true }
          },
          updatedBy: {
            select: { name: true }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      })

      settings = allSettings.map(setting => ({
        id: setting.id,
        orgId: setting.orgId,
        roomType: setting.roomType,
        settings: JSON.parse(setting.settings as string),
        createdAt: setting.createdAt.toISOString(),
        updatedAt: setting.updatedAt.toISOString(),
        createdBy: setting.createdBy.name,
        updatedBy: setting.updatedBy.name
      }))
    }

    return NextResponse.json({
      success: true,
      settings
    })

  } catch (error) {
    console.error('Error loading general settings:', error)
    return NextResponse.json(
      { error: 'Failed to load general settings' },
      { status: 500 }
    )
  }
}

// POST: Save/update general settings
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
    const { orgId, roomType, settings } = body

    if (!orgId || !roomType || !settings) {
      return NextResponse.json(
        { error: 'Organization ID, room type, and settings are required' },
        { status: 400 }
      )
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify user has access to organization
    const userInOrg = await prisma.user.findFirst({
      where: {
        id: currentUser.id,
        organizationUsers: {
          some: {
            organizationId: orgId
          }
        }
      }
    })

    if (!userInOrg) {
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      )
    }

    // Save or update general settings
    const savedSettings = await prisma.fFEGeneralSettings.upsert({
      where: {
        orgId_roomType: {
          orgId: orgId,
          roomType: roomType
        }
      },
      update: {
        settings: JSON.stringify(settings),
        updatedById: currentUser.id,
        updatedAt: new Date()
      },
      create: {
        orgId: orgId,
        roomType: roomType,
        settings: JSON.stringify(settings),
        createdById: currentUser.id,
        updatedById: currentUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'General settings saved successfully',
      settingsId: savedSettings.id
    })

  } catch (error) {
    console.error('Error saving general settings:', error)
    return NextResponse.json(
      { error: 'Failed to save general settings' },
      { status: 500 }
    )
  }
}

// DELETE: Remove general settings
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const roomType = searchParams.get('roomType')

    if (!orgId || !roomType) {
      return NextResponse.json(
        { error: 'Organization ID and room type are required' },
        { status: 400 }
      )
    }

    // Get current user and verify admin access
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        organizationUsers: {
          where: { organizationId: orgId },
          select: { role: true }
        }
      }
    })

    if (!currentUser || !currentUser.organizationUsers.length) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const userRole = currentUser.organizationUsers[0].role
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Delete the general settings
    await prisma.fFEGeneralSettings.delete({
      where: {
        orgId_roomType: {
          orgId: orgId,
          roomType: roomType
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'General settings deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting general settings:', error)
    return NextResponse.json(
      { error: 'Failed to delete general settings' },
      { status: 500 }
    )
  }
}
