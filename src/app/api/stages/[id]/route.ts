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
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { action, assignedTo, dueDate } = data

    // Find the stage and verify access
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
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    let updateData: any = {}

    if (action === 'start') {
      updateData = {
        status: 'IN_PROGRESS',
        assignedTo: assignedTo || stage.assignedTo,
        dueDate: dueDate ? new Date(dueDate) : null
      }

      // Update room status to IN_PROGRESS if it's not started
      if (stage.room.status === 'NOT_STARTED') {
        await prisma.room.update({
          where: { id: stage.roomId },
          data: { 
            status: 'IN_PROGRESS',
            currentStage: stage.type
          }
        })
      } else {
        // Just update current stage
        await prisma.room.update({
          where: { id: stage.roomId },
          data: { currentStage: stage.type }
        })
      }
    } else if (action === 'complete') {
      updateData = {
        status: 'COMPLETED',
        completedAt: new Date()
      }

      // Check if this is the last stage
      const allStages = await prisma.stage.findMany({
        where: { roomId: stage.roomId },
        orderBy: { createdAt: 'asc' }
      })

      const currentIndex = allStages.findIndex(s => s.id === stage.id)
      const isLastStage = currentIndex === allStages.length - 1

      if (isLastStage) {
        // Mark room as completed
        await prisma.room.update({
          where: { id: stage.roomId },
          data: { 
            status: 'COMPLETED',
            currentStage: 'COMPLETED'
          }
        })

        // Check if all rooms in project are completed
        const projectRooms = await prisma.room.findMany({
          where: { projectId: stage.room.project.id }
        })

        const allRoomsCompleted = projectRooms.every(room => 
          room.id === stage.roomId || room.status === 'COMPLETED'
        )

        if (allRoomsCompleted) {
          // Mark project as completed
          await prisma.project.update({
            where: { id: stage.room.project.id },
            data: { status: 'COMPLETED' }
          })
        }
      } else {
        // Handle next stages based on workflow logic
        if (stage.type === 'CLIENT_APPROVAL') {
          // After client approval, both FFE and DRAWINGS can start in parallel
          const ffeStage = allStages.find(s => s.type === 'FFE')
          const drawingsStage = allStages.find(s => s.type === 'DRAWINGS')
          
          // Make both FFE and Drawings ready to start
          if (ffeStage && ffeStage.status === 'NOT_STARTED') {
            await prisma.stage.update({
              where: { id: ffeStage.id },
              data: { status: 'NOT_STARTED' } // Ready to start
            })
          }
          
          if (drawingsStage && drawingsStage.status === 'NOT_STARTED') {
            await prisma.stage.update({
              where: { id: drawingsStage.id },
              data: { status: 'NOT_STARTED' } // Ready to start
            })
          }
          
          // Update room to indicate both stages can start
          await prisma.room.update({
            where: { id: stage.roomId },
            data: { currentStage: 'PARALLEL_FFE_DRAWINGS' }
          })
        } else {
          // Sequential flow for other stages
          const nextStage = allStages[currentIndex + 1]
          if (nextStage && nextStage.status === 'NOT_STARTED') {
            await prisma.room.update({
              where: { id: stage.roomId },
              data: { currentStage: nextStage.type }
            })
          }
        }
      }
    } else if (action === 'pause') {
      updateData = {
        status: 'ON_HOLD'
      }

      await prisma.room.update({
        where: { id: stage.roomId },
        data: { status: 'ON_HOLD' }
      })
    } else if (action === 'needs_attention') {
      updateData = {
        status: 'NEEDS_ATTENTION'
      }

      await prisma.room.update({
        where: { id: stage.roomId },
        data: { status: 'NEEDS_ATTENTION' }
      })
    } else if (action === 'reopen') {
      // Allow reopening completed stages for revisions
      updateData = {
        status: 'IN_PROGRESS',
        completedAt: null // Clear completion timestamp
      }

      // Update room status if needed
      if (stage.room.status === 'COMPLETED') {
        await prisma.room.update({
          where: { id: stage.roomId },
          data: { 
            status: 'IN_PROGRESS',
            currentStage: stage.type
          }
        })
      }
    }

    // Update the stage
    const updatedStage = await prisma.stage.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        assignedUser: {
          select: { name: true }
        },
        designSections: true,
        room: {
          include: {
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              }
            },
            ffeItems: true
          }
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
    
    if (!session?.user?.orgId) {
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
        designSections: true,
        room: {
          include: {
            project: {
              select: { name: true }
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
