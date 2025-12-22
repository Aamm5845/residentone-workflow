import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemIds, sectionName } = await request.json()

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'itemIds array is required' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Update the order of each item
    // The order is determined by the position in the itemIds array
    const updates = itemIds.map((itemId: string, index: number) => 
      prisma.roomFFEItem.update({
        where: { id: itemId },
        data: { 
          order: index + 1,
          updatedById: session.user.id,
          updatedAt: new Date()
        }
      })
    )

    await prisma.$transaction(updates)

    return NextResponse.json({
      success: true,
      message: `Reordered ${itemIds.length} items`,
      sectionName
    })

  } catch (error) {
    console.error('Error reordering specs:', error)
    return NextResponse.json({
      error: 'Failed to reorder items',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

