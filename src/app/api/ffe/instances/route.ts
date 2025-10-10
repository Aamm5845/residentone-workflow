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
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // Check if room exists and user has access
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          OR: [
            { createdBy: session.user.id },
            { 
              stages: {
                some: {
                  assignedTo: session.user.id
                }
              }
            }
          ]
        }
      },
      include: {
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ 
        error: 'Room not found or access denied' 
      }, { status: 404 })
    }

    // Get or create FFE instance for this room
    let instance = await prisma.roomFFEInstance.findUnique({
      where: {
        roomId: roomId
      },
      include: {
        sections: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          include: {
            items: {
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
            }
          }
        }
      }
    })

    // Create instance if it doesn't exist
    if (!instance) {
      instance = await prisma.roomFFEInstance.create({
        data: {
          roomId: roomId,
          name: `FFE for ${room.type}`,
          status: 'NOT_STARTED',
          progress: 0,
          createdById: session.user.id,
          updatedById: session.user.id
        },
        include: {
          sections: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: {
              items: {
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
              }
            }
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      instance
    })

  } catch (error) {
    console.error('Error fetching/creating FFE instance:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch FFE instance' 
    }, { status: 500 })
  }
}