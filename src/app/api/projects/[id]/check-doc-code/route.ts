import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/check-doc-code?docCode=XXX&excludeItemId=YYY
 * Check if a doc code already exists in the project
 * Returns whether duplicate exists and list of items with that doc code
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const docCode = searchParams.get('docCode')?.trim()
    const excludeItemId = searchParams.get('excludeItemId') // Optional: exclude current item when editing

    if (!docCode) {
      return NextResponse.json({ error: 'Doc code is required' }, { status: 400 })
    }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Search for items with the same doc code in this project (RoomFFEItem - specs/products)
    const itemsWithDocCode = await prisma.roomFFEItem.findMany({
      where: {
        docCode: { equals: docCode, mode: 'insensitive' },
        section: {
          instance: {
            room: {
              projectId
            }
          }
        },
        ...(excludeItemId ? { id: { not: excludeItemId } } : {})
      },
      select: {
        id: true,
        name: true,
        docCode: true,
        section: {
          select: {
            name: true,
            instance: {
              select: {
                room: {
                  select: {
                    name: true,
                    type: true
                  }
                }
              }
            }
          }
        }
      }
    })

    const duplicates = itemsWithDocCode.map(item => ({
      id: item.id,
      name: item.name,
      docCode: item.docCode,
      roomName: item.section?.instance?.room?.name || item.section?.instance?.room?.type || 'Unknown Room',
      sectionName: item.section?.name || 'Unknown Section'
    }))

    return NextResponse.json({
      isDuplicate: duplicates.length > 0,
      duplicateCount: duplicates.length,
      duplicates
    })
  } catch (error) {
    console.error('Error checking doc code:', error)
    return NextResponse.json(
      { error: 'Failed to check doc code' },
      { status: 500 }
    )
  }
}
