import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId
    let userId = session.user.id
    
    if (!orgId || !userId) {
      
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })
      
      if (!user) {
        
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      userId = user.id
      orgId = user.orgId
      
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
          orgId: orgId
        }
      },
      include: {
        project: {
          select: { id: true, name: true, orgId: true }
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
          name: `FFE for ${room.project.name} - ${room.type}`,
          status: 'NOT_STARTED',
          progress: 0,
          createdById: userId,
          updatedById: userId
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
