import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 })
    }

    // Fetch sections for the FFE instance
    const sections = await prisma.roomFFESection.findMany({
      where: {
        instanceId: instanceId
      },
      include: {
        items: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
        },
        templateSection: {
          select: {
            name: true,
            description: true,
            icon: true,
            color: true
          }
        }
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
    })

    return NextResponse.json({
      success: true,
      sections
    })

  } catch (error) {
    console.error('Error fetching FFE sections:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch FFE sections' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { instanceId, name, description, order, icon, color } = await request.json()

    // Validation
    if (!instanceId || !name) {
      return NextResponse.json({ 
        error: 'instanceId and name are required' 
      }, { status: 400 })
    }

    // Check if the FFE instance exists and user has access
    const instance = await prisma.roomFFEInstance.findFirst({
      where: {
        id: instanceId,
        room: {
          project: {
            // User must be part of organization
            createdBy: session.user.id
          }
        }
      }
    })

    if (!instance) {
      return NextResponse.json({ 
        error: 'FFE instance not found or access denied' 
      }, { status: 404 })
    }

    // If no order provided, set it to be last
    let sectionOrder = order
    if (sectionOrder === undefined || sectionOrder === null) {
      const maxOrder = await prisma.roomFFESection.findFirst({
        where: { instanceId },
        orderBy: { order: 'desc' },
        select: { order: true }
      })
      sectionOrder = (maxOrder?.order || 0) + 1
    }

    // Create new section
    const newSection = await prisma.roomFFESection.create({
      data: {
        instanceId,
        name: name.trim(),
        description: description?.trim() || null,
        order: sectionOrder,
        isExpanded: true,
        isCompleted: false
      },
      include: {
        items: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
        },
        templateSection: {
          select: {
            name: true,
            description: true,
            icon: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Section created successfully',
      section: newSection
    })

  } catch (error) {
    console.error('Error creating FFE section:', error)
    return NextResponse.json({ 
      error: 'Failed to create FFE section' 
    }, { status: 500 })
  }
}
