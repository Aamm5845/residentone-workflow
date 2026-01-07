import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Helper to get user from API key or session
async function getAuthenticatedUser(request: NextRequest) {
  const apiKey = request.headers.get('X-Extension-Key')
  
  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            orgId: true,
            role: true
          }
        }
      }
    })
    
    if (token?.createdBy) {
      return token.createdBy
    }
  }
  
  const session = await getSession()
  
  if (!session?.user?.email) {
    return null
  }
  
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true
    }
  })
  
  return user
}

// POST: Save a clipped item to FFE and/or Product Library
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }
    
    const body = await request.json()
    const { roomId, sectionId, linkItemId, additionalLinkItemIds, item, destination = 'room', categoryId } = body
    
    // destination can be: 'room', 'library', or 'both'
    const addToLibrary = destination === 'library' || destination === 'both'
    const addToRoom = destination === 'room' || destination === 'both'
    
    // If only adding to library, we don't need roomId/sectionId
    if (addToLibrary && !addToRoom) {
      return await addToProductLibrary(user, item, categoryId)
    }
    
    // Validate required fields for room
    if (addToRoom && !roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }
    
    // sectionId only required if not linking to existing item
    if (addToRoom && !sectionId && !linkItemId) {
      return NextResponse.json({ error: 'sectionId is required when not linking to existing item' }, { status: 400 })
    }
    
    if (!item?.name && !linkItemId) {
      return NextResponse.json({ error: 'item.name is required when not linking to existing item' }, { status: 400 })
    }
    
    // If adding to both, first add to library
    let libraryProduct = null
    if (addToLibrary) {
      const libraryResult = await createLibraryProduct(user, item, categoryId)
      libraryProduct = libraryResult
    }
    
    // Verify room belongs to user's organization
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: user.orgId
        }
      },
      include: {
        ffeInstance: true
      }
    })
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    // If linking to existing item(s), create linked spec items for each requirement
    if (linkItemId) {
      // Collect all item IDs to link (primary + additional)
      const allItemIdsToLink = [linkItemId]
      if (additionalLinkItemIds && Array.isArray(additionalLinkItemIds)) {
        allItemIdsToLink.push(...additionalLinkItemIds)
      }
      
      // Get unique IDs
      const uniqueItemIds = [...new Set(allItemIdsToLink)]
      
      // Verify all items exist and belong to user's org
      const existingItems = await prisma.roomFFEItem.findMany({
        where: {
          id: { in: uniqueItemIds },
          section: {
            instance: {
              room: {
                project: {
                  orgId: user.orgId
                }
              }
            }
          }
        },
        select: {
          id: true,
          name: true,
          sectionId: true,
          description: true,
          quantity: true,
          notes: true,
          customFields: true,
          docCode: true, // Fetch docCode to copy to linked spec item
          section: {
            select: {
              instanceId: true,
              id: true
            }
          },
          // Check how many specs are already linked
          linkedSpecs: {
            select: { id: true }
          }
        }
      })
      
      if (existingItems.length === 0) {
        return NextResponse.json({ error: 'No valid items to link found' }, { status: 404 })
      }
      
      // Track affected FFE instances for progress update
      const affectedInstanceIds = new Set<string>()
      const linkedItems: Array<{ id: string; name: string; sectionId: string; specItemId: string }> = []
      
      // Create a linked spec item for each requirement
      for (const existingItem of existingItems) {
        affectedInstanceIds.add(existingItem.section.instanceId)
        
        // Get next order in section
        const lastItem = await prisma.roomFFEItem.findFirst({
          where: { sectionId: existingItem.sectionId },
          orderBy: { order: 'desc' },
          select: { order: true }
        })
        const nextOrder = (lastItem?.order || 0) + 1
        
        // Check if this is an option (if requirement already has specs)
        const existingSpecsCount = existingItem.linkedSpecs?.length || 0
        const isOption = existingSpecsCount > 0
        const optionNumber = isOption ? existingSpecsCount + 1 : null
        
        // Create a NEW spec item linked to the requirement
        console.log('[Extension Clip] Creating spec item for requirement:', {
          requirementId: existingItem.id,
          requirementName: existingItem.name,
          sectionId: existingItem.sectionId,
          productName: item.name
        })
        
        const specItem = await prisma.roomFFEItem.create({
          data: {
            sectionId: existingItem.sectionId,
            // Use product name, not the requirement name
            name: item.name,
            description: item.description || null,
            state: 'PENDING',
            visibility: 'VISIBLE',
            // Mark as a spec item linked to the requirement
            isSpecItem: true,
            ffeRequirementId: existingItem.id,
            isOption: isOption,
            optionNumber: optionNumber,
            specStatus: 'SELECTED',
            isRequired: false,
            isCustom: true,
            order: nextOrder,
            // Supplier
            supplierName: item.supplierName || null,
            supplierLink: item.supplierLink || null,
            // Product details
            brand: item.brand || null,
            sku: item.sku || null,
            // Use item's docCode if provided, otherwise copy from FFE requirement
            docCode: item.docCode || existingItem.docCode || null,
            modelNumber: item.sku || null,
            color: item.colour || null,
            finish: item.finish || null,
            material: item.material || null,
            leadTime: item.leadTime || null,
            // Dimensions
            width: item.width || null,
            height: item.height || null,
            depth: item.depth || null,
            // Pricing
            quantity: item.quantity || 1,
            unitCost: item.rrp ? parseFloat(item.rrp) : null,
            rrp: item.rrp ? parseFloat(item.rrp) : null,
            tradePrice: item.tradePrice ? parseFloat(item.tradePrice) : null,
            // Images and attachments
            images: item.images || [],
            notes: item.notes || null,
            attachments: item.attachments ? { files: item.attachments } : {},
            // Supplier ID (direct field, not in customFields)
            supplierId: item.supplierId || null,
            // Custom fields
            customFields: {
              length: item.length || null
            },
            createdById: user.id,
            updatedById: user.id
          }
        })

        console.log('[Extension Clip] Created spec item:', {
          specItemId: specItem.id,
          specItemName: specItem.name,
          ffeRequirementId: specItem.ffeRequirementId,
          isSpecItem: specItem.isSpecItem,
          visibility: specItem.visibility
        })
        
        // Verify the link was created by re-fetching the requirement with linkedSpecs
        const verifyRequirement = await prisma.roomFFEItem.findUnique({
          where: { id: existingItem.id },
          include: {
            linkedSpecs: { select: { id: true, name: true } }
          }
        })
        console.log('[Extension Clip] Verification - requirement now has linkedSpecs:', {
          requirementId: existingItem.id,
          linkedSpecsCount: verifyRequirement?.linkedSpecs?.length || 0,
          linkedSpecs: verifyRequirement?.linkedSpecs
        })
        
        linkedItems.push({
          id: existingItem.id,
          name: existingItem.name,
          sectionId: existingItem.sectionId,
          specItemId: specItem.id
        })
      }
      
      // Update progress for all affected FFE instances
      for (const instanceId of affectedInstanceIds) {
        await updateFFEProgress(instanceId)
      }
      
      const linkedCount = linkedItems.length
      return NextResponse.json({
        ok: true,
        linked: true,
        linkedCount,
        items: linkedItems,
        item: linkedItems[0], // Primary item for backwards compatibility
        message: linkedCount > 1 
          ? `Product linked to ${linkedCount} FFE items successfully`
          : `Product linked to "${linkedItems[0].name}" successfully`
      })
    }
    
    // Create or get FFE instance for the room (for new items)
    let ffeInstance = room.ffeInstance
    
    if (!ffeInstance) {
      ffeInstance = await prisma.roomFFEInstance.create({
        data: {
          roomId: room.id,
          name: `${room.name || room.type} FFE`,
          status: 'IN_PROGRESS',
          progress: 0,
          createdById: user.id,
          updatedById: user.id
        }
      })
    }
    
    // Handle section - could be existing ID or new section name
    let targetSectionId = sectionId
    
    // Check if sectionId starts with 'new_' or 'lib_' (indicating we need to create it)
    if (sectionId.startsWith('new_') || sectionId.startsWith('lib_')) {
      const sectionName = sectionId.startsWith('new_') 
        ? sectionId.replace('new_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : await getSectionNameFromLibrary(sectionId.replace('lib_', ''))
      
      // Get next order
      const existingSections = await prisma.roomFFESection.findMany({
        where: { instanceId: ffeInstance.id },
        orderBy: { order: 'desc' },
        take: 1
      })
      
      const nextOrder = existingSections.length > 0 ? existingSections[0].order + 1 : 1
      
      // Create the section
      const newSection = await prisma.roomFFESection.create({
        data: {
          instanceId: ffeInstance.id,
          name: sectionName,
          order: nextOrder,
          isExpanded: true,
          isCompleted: false
        }
      })
      
      targetSectionId = newSection.id
    } else {
      // Verify section exists and belongs to this room's instance
      const section = await prisma.roomFFESection.findFirst({
        where: {
          id: sectionId,
          instanceId: ffeInstance.id
        }
      })
      
      if (!section) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 })
      }
    }
    
    // Get next item order
    const existingItems = await prisma.roomFFEItem.findMany({
      where: { sectionId: targetSectionId },
      orderBy: { order: 'desc' },
      take: 1
    })
    
    const nextOrder = existingItems.length > 0 ? existingItems[0].order + 1 : 1
    
    // Create the FFE item - This is an actual spec (not a task/requirement)
    // Set specStatus to 'SELECTED' so it shows in All Spec view
    const newItem = await prisma.roomFFEItem.create({
      data: {
        sectionId: targetSectionId,
        name: item.name,
        description: item.description || null,
        state: 'PENDING',
        visibility: 'VISIBLE',
        specStatus: 'SELECTED', // Actual spec from Chrome extension
        isRequired: false,
        isCustom: true,
        order: nextOrder,
        quantity: item.quantity || 1,
        // Pricing
        unitCost: item.rrp ? parseFloat(item.rrp) : null,
        rrp: item.rrp ? parseFloat(item.rrp) : null,
        tradePrice: item.tradePrice ? parseFloat(item.tradePrice) : null,
        // Supplier
        supplierName: item.supplierName || null,
        supplierLink: item.supplierLink || null,
        // Product details - mapped to actual fields
        brand: item.brand || null,
        sku: item.sku || null,
        docCode: item.docCode || null,
        modelNumber: item.sku || null, // SKU can also be model number
        color: item.colour || null,
        finish: item.finish || null,
        material: item.material || null,
        leadTime: item.leadTime || null,
        // Dimensions
        width: item.width || null,
        height: item.height || null,
        depth: item.depth || null,
        // Images and attachments
        images: item.images || [],
        notes: item.notes || null,
        attachments: item.attachments ? { files: item.attachments } : {},
        // Supplier ID (direct field, not in customFields)
        supplierId: item.supplierId || null,
        // Custom fields for any extras
        customFields: {
          length: item.length || null
        },
        createdById: user.id,
        updatedById: user.id
      }
    })

    // Update FFE instance progress
    await updateFFEProgress(ffeInstance.id)
    
    return NextResponse.json({
      ok: true,
      item: {
        id: newItem.id,
        name: newItem.name,
        sectionId: targetSectionId
      },
      libraryProduct: libraryProduct,
      message: libraryProduct 
        ? `Item "${item.name}" saved to room and library`
        : `Item "${item.name}" saved successfully`
    })
    
  } catch (error) {
    console.error('Extension clip error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper to add item to product library only
async function addToProductLibrary(user: any, item: any, categoryId?: string) {
  const product = await createLibraryProduct(user, item, categoryId)
  
  return NextResponse.json({
    ok: true,
    libraryProduct: product,
    message: `Product "${item.name}" added to library`
  })
}

// Helper to create a product in the library
async function createLibraryProduct(user: any, item: any, categoryId?: string) {
  const product = await prisma.productLibraryItem.create({
    data: {
      orgId: user.orgId,
      categoryId: categoryId || null,
      name: item.name,
      description: item.description || null,
      // Product details - direct from item
      brand: item.brand || null,
      sku: item.sku || null,
      modelNumber: item.sku || null,
      color: item.colour || null,
      finish: item.finish || null,
      material: item.material || null,
      // Dimensions
      width: item.width || null,
      height: item.height || null,
      depth: item.depth || null,
      length: item.length || null,
      // Pricing
      rrp: item.rrp ? parseFloat(item.rrp) : null,
      tradePrice: item.tradePrice ? parseFloat(item.tradePrice) : null,
      // Supplier
      supplierName: item.supplierName || null,
      supplierLink: item.supplierLink || null,
      leadTime: item.leadTime || null,
      // Images and attachments
      images: item.images || [],
      thumbnailUrl: item.images?.[0] || null,
      attachments: item.attachments?.length > 0 ? { files: item.attachments } : null,
      notes: item.notes || null,
      // Custom fields for extras
      customFields: {
        docCode: item.docCode || null,
        supplierId: item.supplierId || null
      },
      tags: [],
      status: 'ACTIVE',
      createdById: user.id,
      updatedById: user.id
    }
  })
  
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId
  }
}

// Helper to get section name from library
async function getSectionNameFromLibrary(libraryId: string): Promise<string> {
  const librarySection = await prisma.fFESectionLibrary.findUnique({
    where: { id: libraryId },
    select: { name: true }
  })
  
  return librarySection?.name || 'Uncategorized'
}

// Helper to update FFE instance progress
async function updateFFEProgress(instanceId: string) {
  const items = await prisma.roomFFEItem.findMany({
    where: {
      section: {
        instanceId: instanceId
      },
      visibility: 'VISIBLE'
    },
    select: {
      state: true
    }
  })
  
  if (items.length === 0) {
    return
  }
  
  const completedCount = items.filter(i => 
    ['CONFIRMED', 'COMPLETED', 'NOT_NEEDED'].includes(i.state)
  ).length
  
  const progress = Math.round((completedCount / items.length) * 100)
  
  await prisma.roomFFEInstance.update({
    where: { id: instanceId },
    data: {
      progress: progress,
      status: progress === 100 ? 'COMPLETED' : 'IN_PROGRESS'
    }
  })
}
