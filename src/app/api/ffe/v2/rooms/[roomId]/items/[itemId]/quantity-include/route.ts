import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string, itemId: string }> }
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
    
    const { roomId, itemId } = await params
    const { quantity, customName, visibility = 'VISIBLE' } = await request.json()
    
    console.log('🔍 Quantity include request:', { roomId, itemId, quantity, customName, visibility });

    if (!roomId || !itemId || !quantity || quantity < 1) {
      return NextResponse.json({ error: 'Room ID, item ID, and valid quantity are required' }, { status: 400 })
    }

    // Verify the item exists and belongs to user's organization
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId
              }
            }
          }
        }
      },
      include: {
        section: {
          include: {
            instance: true
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // If quantity is 1 and no custom name, just update visibility
    if (quantity === 1 && !customName) {
      const updatedItem = await prisma.roomFFEItem.update({
        where: { id: itemId },
        data: {
          visibility: visibility as 'VISIBLE' | 'HIDDEN',
          quantity: 1,
          updatedById: userId
        }
      })

      return NextResponse.json({
        success: true,
        data: { items: [updatedItem] },
        message: `"${item.name}" included in workspace`
      })
    }

    // For multiple quantities or custom names, we need to create duplicate items
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = []
      
      // Update the original item
      const originalItem = await tx.roomFFEItem.update({
        where: { id: itemId },
        data: {
          visibility: visibility as 'VISIBLE' | 'HIDDEN',
          quantity: 1,
          name: customName ? `${customName}` : item.name,
          updatedById: userId
        }
      })
      createdItems.push(originalItem)

      // Create additional items for quantity > 1
      for (let i = 2; i <= quantity; i++) {
        const newItem = await tx.roomFFEItem.create({
          data: {
            sectionId: item.sectionId,
            templateItemId: item.templateItemId,
            name: customName ? `${customName} (${i})` : `${item.name} (${i})`,
            description: item.description,
            state: 'PENDING',
            visibility: visibility as 'VISIBLE' | 'HIDDEN',
            isRequired: item.isRequired,
            isCustom: true, // Mark duplicates as custom
            order: item.order + (i - 1) * 0.1, // Slightly increment order
            quantity: 1,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            supplierName: item.supplierName,
            supplierLink: item.supplierLink,
            modelNumber: item.modelNumber,
            notes: null, // Start with empty notes for new items
            attachments: item.attachments,
            customFields: item.customFields,
            createdById: userId,
            updatedById: userId
          }
        })
        createdItems.push(newItem)
      }

      return createdItems
    })

    const itemName = customName || item.name
    return NextResponse.json({
      success: true,
      data: { items: result },
      message: quantity === 1 
        ? `"${itemName}" included in workspace`
        : `${quantity} "${itemName}" items included in workspace`
    })

  } catch (error) {
    console.error('Error including items with quantity:', error)
    return NextResponse.json(
      { error: 'Failed to include items with quantity' },
      { status: 500 }
    )
  }
}