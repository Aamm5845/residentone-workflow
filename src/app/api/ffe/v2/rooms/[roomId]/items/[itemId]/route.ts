import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
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
    const { name, description, quantity, state } = await request.json()

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and Item ID are required' 
      }, { status: 400 })
    }

    // Verify item exists and belongs to user's organization
    const existingItem = await prisma.roomFFEItem.findFirst({
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
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Update the item
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(quantity !== undefined && { quantity }),
        ...(state !== undefined && { state }),
        updatedById: userId,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully'
    })

  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Verify item exists and belongs to user's organization
    const existingItem = await prisma.roomFFEItem.findFirst({
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
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete the item
    await prisma.roomFFEItem.delete({
      where: { id: itemId }
    })

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}

// Update item fields OR move to different section
export async function PATCH(
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
    const body = await request.json()
    const { 
      targetSectionId, 
      customFields,
      // Field updates
      name,
      sku,
      productName,
      modelNumber,
      brand,
      supplierName,
      supplierLink,
      specStatus,
      state,
      visibility,
      quantity,
      tradePrice,
      rrp,
      tradeDiscount,
      unitCost,
      description,
      color,
      finish,
      material,
      leadTime
    } = body

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and Item ID are required' 
      }, { status: 400 })
    }
    
    // Verify item exists and belongs to user's organization
    const existingItem = await prisma.roomFFEItem.findFirst({
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
          select: {
            name: true
          }
        }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    
    // Build update data object with only provided fields
    const updateData: any = {
      updatedById: userId,
      updatedAt: new Date()
    }
    
    // Add field updates if provided
    if (name !== undefined) updateData.name = name
    if (sku !== undefined) updateData.sku = sku
    if (productName !== undefined) updateData.modelNumber = productName // productName maps to modelNumber
    if (modelNumber !== undefined) updateData.modelNumber = modelNumber
    if (brand !== undefined) updateData.brand = brand
    if (supplierName !== undefined) updateData.supplierName = supplierName
    if (supplierLink !== undefined) updateData.supplierLink = supplierLink
    if (specStatus !== undefined) updateData.specStatus = specStatus
    if (state !== undefined) updateData.state = state
    if (visibility !== undefined) updateData.visibility = visibility
    if (quantity !== undefined) updateData.quantity = parseInt(quantity) || 1
    if (tradePrice !== undefined) updateData.tradePrice = tradePrice ? parseFloat(tradePrice) : null
    if (rrp !== undefined) updateData.rrp = rrp ? parseFloat(rrp) : null
    if (tradeDiscount !== undefined) updateData.tradeDiscount = tradeDiscount ? parseFloat(tradeDiscount) : null
    if (unitCost !== undefined) updateData.unitCost = unitCost ? parseFloat(unitCost) : null
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color
    if (finish !== undefined) updateData.finish = finish
    if (material !== undefined) updateData.material = material
    if (leadTime !== undefined) updateData.leadTime = leadTime
    
    // Handle customFields merge
    if (customFields !== undefined) {
      const existingCustomFields = (existingItem.customFields as any) || {}
      updateData.customFields = { ...existingCustomFields, ...customFields }
    }
    
    // Handle moving to different section
    if (targetSectionId && targetSectionId !== existingItem.sectionId) {
      // Verify target section exists
      const targetSection = await prisma.roomFFESection.findFirst({
        where: {
          id: targetSectionId,
          instance: {
            roomId,
            room: {
              project: {
                orgId: orgId
              }
            }
          }
        }
      })

      if (!targetSection) {
        return NextResponse.json({ error: 'Target section not found' }, { status: 404 })
      }
      
      // Get the highest order in target section
      const targetSectionItems = await prisma.roomFFEItem.findMany({
        where: { sectionId: targetSectionId },
        orderBy: { order: 'desc' },
        take: 1
      })
      
      updateData.sectionId = targetSectionId
      updateData.order = targetSectionItems.length > 0 ? targetSectionItems[0].order + 1 : 1
    }
    
    // If we have any updates to make (beyond just userId/updatedAt)
    if (Object.keys(updateData).length > 2) {
      const updatedItem = await prisma.roomFFEItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          section: {
            select: {
              name: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: updatedItem,
        message: 'Item updated successfully'
      })
    }

    // No updates provided
    return NextResponse.json({ 
      error: 'No update fields provided' 
    }, { status: 400 })

  } catch (error) {
    console.error('Error moving item:', error)
    return NextResponse.json(
      { error: 'Failed to move item' },
      { status: 500 }
    )
  }
}
