import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { searchParams } = new URL(request.url)
    const includeHidden = searchParams.get('includeHidden') === 'true'
    const onlyVisible = searchParams.get('onlyVisible') === 'true'
    const sectionId = searchParams.get('sectionId')

    // Build visibility filter
    let visibilityWhere: any = {}
    if (onlyVisible || (!includeHidden && !onlyVisible)) {
      visibilityWhere.visibility = 'VISIBLE'
    }

    // Add section filter if provided
    if (sectionId) {
      visibilityWhere.sectionId = sectionId
    }

    // Get all sections with filtered items
    const instance = await prisma.roomFFEInstance.findUnique({
      where: {
        roomId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        sections: {
          include: {
            items: {
              where: visibilityWhere,
              include: {
                templateItem: true,
                createdBy: {
                  select: { name: true, email: true }
                },
                updatedBy: {
                  select: { name: true, email: true }
                }
              },
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!instance) {
      return NextResponse.json({ error: 'FFE instance not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        instance: {
          id: instance.id,
          name: instance.name,
          status: instance.status,
          progress: instance.progress
        },
        sections: instance.sections
      }
    })

  } catch (error) {
    console.error('Error fetching FFE items:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { 
      sectionId, 
      name, 
      description, 
      quantity = 1,
      // If isSpec is true, this is an actual spec (from All Spec view) not a task
      isSpec = false,
      // NEW: FFE Workspace <-> All Specs linking
      isSpecItem = false, // True if this is a product spec (not a requirement)
      ffeRequirementId = null, // Links spec item back to its FFE requirement
      isOption = false, // True if this is an option (multiple products for same FFE item)
      optionNumber = null, // Option number when multiple options exist
      specStatus = null, // Override spec status (SELECTED, DRAFT, etc.)
      visibility = null, // Override visibility
      // Additional spec fields
      brand,
      sku,
      docCode,
      material,
      color,
      finish,
      width,
      height,
      depth,
      length,
      leadTime,
      supplierName,
      supplierLink,
      supplierId,
      unitCost,
      tradePrice,
      rrp,
      tradeDiscount,
      markupPercent,
      currency,
      unitType,
      images,
      notes,
      libraryProductId,
      customFields
    } = await request.json()

    if (!roomId || !sectionId || !name?.trim()) {
      return NextResponse.json({ 
        error: 'Room ID, section ID, and item name are required' 
      }, { status: 400 })
    }

    if (quantity < 1 || quantity > 50) {
      return NextResponse.json({ 
        error: 'Quantity must be between 1 and 50' 
      }, { status: 400 })
    }

    // Verify section belongs to room instance
    const section = await prisma.roomFFESection.findFirst({
      where: {
        id: sectionId,
        instance: {
          roomId,
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        instance: {
          include: {
            room: {
              select: { projectId: true }
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Calculate next order
    const nextOrder = (section.items.length > 0)
      ? Math.max(...section.items.map(i => i.order)) + 1
      : 1

    // Auto-generate doc code if section has prefix and no docCode provided
    let generatedDocCode = docCode || null
    if (!docCode && section.docCodePrefix) {
      // Find the highest existing number for this prefix in the entire project
      const projectId = section.instance.room.projectId
      const existingItems = await prisma.roomFFEItem.findMany({
        where: {
          docCode: { startsWith: `${section.docCodePrefix}-` },
          section: {
            instance: {
              room: { projectId }
            }
          }
        },
        select: { docCode: true }
      })

      // Extract numbers and find the highest
      let maxNumber = 0
      for (const item of existingItems) {
        if (item.docCode) {
          const match = item.docCode.match(new RegExp(`^${section.docCodePrefix}-(\\d+)$`))
          if (match) {
            const num = parseInt(match[1], 10)
            if (num > maxNumber) maxNumber = num
          }
        }
      }

      // Generate next doc code
      generatedDocCode = `${section.docCodePrefix}-${String(maxNumber + 1).padStart(2, '0')}`
    }

    // Create items based on quantity
    const createdItems = []
    let currentDocCodeNumber = 0

    // Parse initial doc code number if we have a generated one
    if (generatedDocCode && section.docCodePrefix) {
      const match = generatedDocCode.match(new RegExp(`^${section.docCodePrefix}-(\\d+)$`))
      if (match) {
        currentDocCodeNumber = parseInt(match[1], 10)
      }
    }

    // If linking to an FFE requirement, fetch its doc code to copy to the spec item
    let ffeRequirementDocCode: string | null = null
    if (ffeRequirementId && !docCode) {
      const ffeReq = await prisma.roomFFEItem.findUnique({
        where: { id: ffeRequirementId },
        select: { docCode: true }
      })
      ffeRequirementDocCode = ffeReq?.docCode || null
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 1; i <= quantity; i++) {
        const itemName = quantity > 1 ? `${name.trim()} #${i}` : name.trim()

        // Determine visibility and specStatus based on item type:
        // - isSpecItem = true: This is a product spec (from All Specs view), linked to FFE requirement
        // - isSpec = true (legacy): This is an actual spec, should be visible
        // - Otherwise: FFE Workspace requirement, starts as visible
        const isActualSpec = isSpecItem || isSpec
        const finalVisibility = visibility || (isActualSpec ? 'VISIBLE' : 'VISIBLE')
        const finalSpecStatus = specStatus || (isActualSpec ? 'SELECTED' : 'DRAFT')

        // Generate unique doc code for each item in bulk creation
        // Priority: explicit docCode > FFE requirement's docCode > auto-generated > null
        let itemDocCode = docCode || ffeRequirementDocCode || null
        if (!docCode && !ffeRequirementDocCode && section.docCodePrefix && currentDocCodeNumber > 0) {
          itemDocCode = `${section.docCodePrefix}-${String(currentDocCodeNumber + i - 1).padStart(2, '0')}`
        } else if (!docCode && !ffeRequirementDocCode && generatedDocCode && i === 1) {
          itemDocCode = generatedDocCode
        }

        const newItem = await tx.roomFFEItem.create({
          data: {
            sectionId,
            name: itemName,
            description: description?.trim() || null,
            state: 'PENDING',
            visibility: finalVisibility,
            specStatus: finalSpecStatus,
            isRequired: false,
            isCustom: true,
            order: nextOrder + i - 1,
            quantity: 1, // Each created item has quantity 1
            // Include spec fields if provided
            brand: brand || null,
            sku: sku || null,
            docCode: itemDocCode,
            material: material || null,
            color: color || null,
            finish: finish || null,
            width: width || null,
            height: height || null,
            depth: depth || null,
            leadTime: leadTime || null,
            supplierName: supplierName || null,
            supplierLink: supplierLink || null,
            unitCost: unitCost ? parseFloat(unitCost) : null,
            tradePrice: tradePrice ? parseFloat(tradePrice) : null,
            rrp: rrp ? parseFloat(rrp) : null,
            tradeDiscount: tradeDiscount ? parseFloat(tradeDiscount) : null,
            markupPercent: markupPercent ? parseFloat(markupPercent) : null,
            currency: currency || 'CAD',
            unitType: unitType || 'units',
            images: images || [],
            libraryProductId: libraryProductId || null,
            notes: notes || null,
            // NEW: FFE Workspace <-> All Specs linking
            isSpecItem: isSpecItem || false,
            ffeRequirementId: ffeRequirementId || null,
            isOption: isOption || false,
            optionNumber: optionNumber || null,
            customFields: customFields || null,
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
        
        createdItems.push(newItem)
      }
    })

    // Log activity if linking a product to an FFE requirement
    if (ffeRequirementId && createdItems.length > 0) {
      try {
        // Get the FFE requirement details and room/project info
        const ffeRequirement = await prisma.roomFFEItem.findUnique({
          where: { id: ffeRequirementId },
          select: {
            name: true,
            section: {
              select: {
                name: true,
                instance: {
                  select: {
                    room: {
                      select: {
                        id: true,
                        name: true,
                        project: {
                          select: {
                            id: true,
                            name: true,
                            orgId: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        if (ffeRequirement) {
          const room = ffeRequirement.section.instance.room
          const project = room.project
          
          await prisma.activityLog.create({
            data: {
              actorId: session.user.id,
              action: 'FFE_PRODUCT_CHOSEN',
              entity: 'FFE_ITEM',
              entityId: ffeRequirementId,
              orgId: project?.orgId,
              details: {
                roomId: room.id,
                roomName: room.name,
                projectId: project?.id,
                projectName: project?.name,
                stageName: 'FFE',
                itemId: ffeRequirementId,
                itemName: ffeRequirement.name,
                sectionName: ffeRequirement.section.name,
                productName: name.trim(),
                productBrand: brand || null,
                productSku: sku || null,
                isOption: isOption || false,
                optionNumber: optionNumber || null
              }
            }
          })
        }
      } catch (logError) {
        console.error('Failed to log FFE product chosen activity:', logError)
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({
      success: true,
      data: createdItems,
      message: `Added ${quantity} item${quantity > 1 ? 's' : ''} to section`
    })

  } catch (error) {
    console.error('Error adding items:', error)
    return NextResponse.json(
      { error: 'Failed to add items' },
      { status: 500 }
    )
  }
}

// Update item state and notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { itemId, state, notes } = await request.json()

    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and item ID are required' 
      }, { status: 400 })
    }

    // Verify item belongs to room instance
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      },
      include: {
        section: {
          include: {
            instance: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const previousState = item.state

    // Prepare update data
    const updateData: any = {
      updatedById: session.user.id
    }

    if (state) {
      updateData.state = state
      if (state === 'COMPLETED') {
        updateData.completedAt = new Date()
        updateData.completedById = session.user.id
      } else {
        updateData.completedAt = null
        updateData.completedById = null
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null
    }

    // Update item
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: updateData
    })

    // Calculate section progress
    const sectionItems = await prisma.roomFFEItem.findMany({
      where: { sectionId: item.sectionId }
    })

    const completedItems = sectionItems.filter(i => i.state === 'COMPLETED').length
    const sectionProgress = sectionItems.length > 0 
      ? (completedItems / sectionItems.length) * 100 
      : 0

    // Update section completion status
    await prisma.roomFFESection.update({
      where: { id: item.sectionId },
      data: {
        isCompleted: sectionProgress === 100
      }
    })

    // Calculate overall instance progress
    const allSections = await prisma.roomFFESection.findMany({
      where: {
        instance: {
          roomId
        }
      },
      include: {
        items: true
      }
    })

    const allItems = allSections.flatMap(s => s.items)
    const allCompletedItems = allItems.filter(i => i.state === 'COMPLETED').length
    const overallProgress = allItems.length > 0 
      ? (allCompletedItems / allItems.length) * 100 
      : 0

    // Update room instance progress
    await prisma.roomFFEInstance.update({
      where: { roomId },
      data: {
        progress: overallProgress,
        status: overallProgress === 100 ? 'COMPLETED' : 'IN_PROGRESS'
      }
    })

    // Log activity if state changed
    if (state && previousState !== state) {
      try {
        const room = item.section.instance.room
        const project = room.project
        
        await prisma.activityLog.create({
          data: {
            actorId: session.user.id,
            action: 'STATE_CHANGE',
            entity: 'FFE_ITEM',
            entityId: itemId,
            orgId: project?.orgId,
            details: {
              roomId,
              roomName: room.name,
              projectId: project?.id,
              projectName: project?.name,
              stageName: 'FFE',
              itemId,
              itemName: item.name,
              sectionName: item.section.name,
              previousState,
              newState: state
            }
          }
        })
      } catch (logError) {
        console.error('Failed to log FFE activity:', logError)
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedItem,
      progress: {
        section: sectionProgress,
        overall: overallProgress
      }
    })

  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// Delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { roomId } = resolvedParams
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const itemIds = searchParams.get('itemIds') // For bulk delete

    // Handle bulk delete
    if (itemIds) {
      const idsArray = itemIds.split(',')
      if (idsArray.length === 0) {
        return NextResponse.json({ 
          error: 'Item IDs are required for bulk delete' 
        }, { status: 400 })
      }

      // Verify all items belong to room instance
      const items = await prisma.roomFFEItem.findMany({
        where: {
          id: { in: idsArray },
          section: {
            instance: {
              roomId,
              room: {
                project: {
                  orgId: session.user.orgId
                }
              }
            }
          }
        }
      })

      if (items.length !== idsArray.length) {
        return NextResponse.json({ 
          error: 'Some items not found or access denied' 
        }, { status: 404 })
      }

      // Delete all items
      await prisma.roomFFEItem.deleteMany({
        where: { id: { in: idsArray } }
      })

      return NextResponse.json({
        success: true,
        message: `${idsArray.length} items deleted successfully`
      })
    }

    // Handle single delete
    if (!roomId || !itemId) {
      return NextResponse.json({ 
        error: 'Room ID and item ID are required' 
      }, { status: 400 })
    }

    // Verify item belongs to room instance
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete item
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