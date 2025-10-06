import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
    }

    const resolvedParams = await params
    const { roomId, itemId } = resolvedParams

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and Item ID are required' 
      }, { status: 400 })
    }

    // Find the original item
    const originalItem = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: orgId
              }
            }
          }
        }
      },
      include: {
        section: {
          include: {
            items: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    if (!originalItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Calculate next order in the section
    const nextOrder = originalItem.section.items.length > 0
      ? Math.max(...originalItem.section.items.map(i => i.order)) + 1
      : 1

    // Create duplicate with intelligent naming
    const baseName = originalItem.name
    const existingItems = originalItem.section.items
    
    // Find existing copies to determine the next number
    const existingCopies = existingItems.filter(item => {
      return item.name === baseName || 
             item.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`))
    })
    
    const nextNumber = existingCopies.length + 1
    const duplicateName = nextNumber === 1 ? baseName : `${baseName} ${nextNumber}`

    const duplicateItem = await prisma.roomFFEItem.create({
      data: {
        sectionId: originalItem.sectionId,
        templateItemId: originalItem.templateItemId,
        name: duplicateName,
        description: originalItem.description,
        state: originalItem.state,
        isRequired: originalItem.isRequired,
        isCustom: originalItem.isCustom,
        order: nextOrder,
        quantity: originalItem.quantity,
        unitCost: originalItem.unitCost,
        totalCost: originalItem.totalCost,
        supplierName: originalItem.supplierName,
        supplierLink: originalItem.supplierLink,
        modelNumber: originalItem.modelNumber,
        notes: originalItem.notes,
        attachments: originalItem.attachments,
        customFields: originalItem.customFields,
        createdById: userId,
        updatedById: userId
      }
    })

    return NextResponse.json({
      success: true,
      data: duplicateItem,
      message: `Item "${originalItem.name}" duplicated successfully`
    })

  } catch (error) {
    console.error('Error duplicating item:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate item' },
      { status: 500 }
    )
  }
}