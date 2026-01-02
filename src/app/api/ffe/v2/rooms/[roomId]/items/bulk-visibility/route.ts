import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Bulk update visibility for all items in a section
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id
    let orgId = session.user.orgId

    if (!userId || !orgId) {
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

    const { roomId } = await params
    const { sectionId, visibility } = await request.json()

    if (!roomId || !sectionId || !visibility) {
      return NextResponse.json({
        error: 'Room ID, section ID, and visibility are required'
      }, { status: 400 })
    }

    if (visibility !== 'VISIBLE' && visibility !== 'HIDDEN') {
      return NextResponse.json({
        error: 'Visibility must be "VISIBLE" or "HIDDEN"'
      }, { status: 400 })
    }

    // Verify section belongs to room and user's organization
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId
            }
          }
        }
      },
      include: {
        items: true
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Update all items in the section
    const result = await prisma.roomFFEItem.updateMany({
      where: {
        sectionId: sectionId
      },
      data: {
        visibility: visibility,
        updatedById: userId
      }
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} items updated to ${visibility.toLowerCase()}`,
      data: {
        updatedCount: result.count,
        sectionId,
        visibility
      }
    })

  } catch (error) {
    console.error('Error updating bulk visibility:', error)
    return NextResponse.json(
      { error: 'Failed to update visibility' },
      { status: 500 }
    )
  }
}
