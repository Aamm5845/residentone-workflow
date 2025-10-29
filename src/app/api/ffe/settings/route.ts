import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get FFE global settings for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    let settings = await prisma.fFEGlobalSettings.findFirst({
      where: { orgId }
    })

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.fFEGlobalSettings.create({
        data: {
          orgId,
          createdById: session.user.id,
          updatedById: session.user.id,
        },
      })
    }

    return NextResponse.json({ settings })

  } catch (error) {
    console.error('Error getting FFE global settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update FFE global settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, ...settingsData } = body

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Check if user has permission to update settings
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const updatedSettings = await prisma.fFEGlobalSettings.upsert({
      where: { orgId },
      create: {
        orgId,
        ...settingsData,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
      update: {
        ...settingsData,
        updatedById: session.user.id,
      },
    })

    // Log the settings update
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'UPDATE',
        entity: 'FFE_SETTINGS',
        entityId: updatedSettings.id,
        details: {
          updatedFields: Object.keys(settingsData),
          orgId
        },
        orgId
      }
    })

    return NextResponse.json({ settings: updatedSettings, message: 'Settings updated successfully' })

  } catch (error) {
    console.error('Error updating FFE global settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
