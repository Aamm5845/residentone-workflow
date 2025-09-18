import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { action, assignedTo, dueDate } = data
    
    // Verify stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }
    
    // Update stage based on action
    let updateData: any = {}
    
    if (action === 'start') {
      updateData.status = 'IN_PROGRESS'
      if (assignedTo) updateData.assignedTo = assignedTo
    } else if (action === 'complete') {
      updateData.status = 'COMPLETED'
      updateData.completedAt = new Date()
    } else if (action === 'pause') {
      updateData.status = 'ON_HOLD'
    } else if (action === 'reopen') {
      updateData.status = 'IN_PROGRESS'
      updateData.completedAt = null
    }
    
    if (dueDate) {
      updateData.dueDate = new Date(dueDate)
    }
    
    const updatedStage = await prisma.stage.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        assignedUser: {
          select: { name: true, email: true }
        }
      }
    })
    
    return NextResponse.json(updatedStage)
  } catch (error) {
    console.error('Error updating stage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get stage details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        assignedUser: {
          select: { name: true, email: true }
        },
        designSections: {
          include: {
            assets: {
              orderBy: { createdAt: 'desc' }
            },
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: {
              select: { name: true, id: true }
            },
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            ffeItems: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Error fetching stage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
