import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get all FFE item templates for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const category = searchParams.get('category')
    const scope = searchParams.get('scope')
    const level = searchParams.get('level')
    const roomType = searchParams.get('roomType')
    const search = searchParams.get('search')
    const includeDeprecated = searchParams.get('includeDeprecated') === 'true'

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    const whereClause: any = { orgId }

    if (!includeDeprecated) {
      whereClause.isActive = true
    }

    if (category) {
      whereClause.category = category
    }

    if (scope) {
      whereClause.scope = scope
    }

    if (level) {
      whereClause.level = level
    }

    if (roomType) {
      whereClause.OR = [
        { roomTypes: { has: roomType } },
        { 
          AND: [
            { scope: 'global' },
            { NOT: { excludeFromRoomTypes: { has: roomType } } }
          ]
        }
      ]
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ]
    }

    const items = await prisma.fFEItemTemplate.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ],
    })

    return NextResponse.json({ items })

  } catch (error) {
    console.error('Error getting FFE item templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new FFE item template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      orgId,
      userId,
      name,
      description,
      category,
      level,
      scope,
      defaultState,
      isRequired,
      supportsMultiChoice,
      roomTypes,
      excludeFromRoomTypes,
      subItems,
      conditionalOn,
      mutuallyExclusiveWith,
      notes,
      tags,
      estimatedCost,
      leadTimeWeeks,
      supplierInfo
    } = body

    if (!orgId || !name || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate unique itemId
    const itemId = `${category}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

    // Check if itemId already exists
    const existingItem = await prisma.fFEItemTemplate.findFirst({
      where: { orgId, itemId }
    })

    if (existingItem) {
      return NextResponse.json({ error: 'Item with this name already exists in this category' }, { status: 409 })
    }

    // Get next order number for this category
    const lastItem = await prisma.fFEItemTemplate.findFirst({
      where: { orgId, category },
      orderBy: { order: 'desc' }
    })

    const nextOrder = lastItem ? lastItem.order + 1 : 1

    const newItem = await prisma.fFEItemTemplate.create({
      data: {
        orgId,
        itemId,
        name,
        description,
        category,
        level: level || 'base',
        scope: scope || 'room_specific',
        defaultState: defaultState || 'pending',
        isRequired: Boolean(isRequired),
        supportsMultiChoice: Boolean(supportsMultiChoice),
        roomTypes: roomTypes || [],
        excludeFromRoomTypes: excludeFromRoomTypes || [],
        subItems: subItems || null,
        conditionalOn: conditionalOn || [],
        mutuallyExclusiveWith: mutuallyExclusiveWith || [],
        notes,
        tags: tags || [],
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        leadTimeWeeks: leadTimeWeeks ? parseInt(leadTimeWeeks) : null,
        supplierInfo: supplierInfo || null,
        order: nextOrder,
        createdById: userId || session.user.id,
        updatedById: userId || session.user.id,
      },
    })

    // Log the creation
    await prisma.fFEVersionHistory.create({
      data: {
        orgId,
        entityType: 'item_template',
        entityId: newItem.id,
        version: newItem.version,
        changeType: 'created',
        changeDescription: `FFE item template "${name}" created`,
        changeDetails: [
          { field: 'name', oldValue: null, newValue: name },
          { field: 'category', oldValue: null, newValue: category },
          { field: 'level', oldValue: null, newValue: level },
          { field: 'scope', oldValue: null, newValue: scope }
        ],
        entitySnapshot: newItem,
        createdById: userId || session.user.id
      }
    })

    return NextResponse.json({ item: newItem, message: 'FFE item template created successfully' })

  } catch (error) {
    console.error('Error creating FFE item template:', error)
    return NextResponse.json({ error: 'Failed to create FFE item template' }, { status: 500 })
  }
}

// Bulk update items (for drag and drop, bulk operations)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, operation, items } = body

    if (!orgId || !operation || !items) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    switch (operation) {
      case 'reorder':
        // Update order for items
        await Promise.all(
          items.map(({ id, order }: { id: string, order: number }) =>
            prisma.fFEItemTemplate.update({
              where: { id },
              data: { order, updatedById: session.user.id }
            })
          )
        )
        break

      case 'move_category':
        // Move items to different category
        const { targetCategory } = body
        await Promise.all(
          items.map(({ id }: { id: string }) =>
            prisma.fFEItemTemplate.update({
              where: { id },
              data: { category: targetCategory, updatedById: session.user.id }
            })
          )
        )
        break

      case 'change_scope':
        // Change scope of items
        const { targetScope } = body
        await Promise.all(
          items.map(({ id }: { id: string }) =>
            prisma.fFEItemTemplate.update({
              where: { id },
              data: { scope: targetScope, updatedById: session.user.id }
            })
          )
        )
        break

      case 'deprecate':
        // Deprecate items
        await Promise.all(
          items.map(({ id }: { id: string }) =>
            prisma.fFEItemTemplate.update({
              where: { id },
              data: { 
                isActive: false, 
                deprecatedAt: new Date(),
                updatedById: session.user.id 
              }
            })
          )
        )
        break

      case 'activate':
        // Reactivate items
        await Promise.all(
          items.map(({ id }: { id: string }) =>
            prisma.fFEItemTemplate.update({
              where: { id },
              data: { 
                isActive: true, 
                deprecatedAt: null,
                updatedById: session.user.id 
              }
            })
          )
        )
        break

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: `${operation} completed successfully` })

  } catch (error) {
    console.error(`Error performing bulk ${body.operation}:`, error)
    return NextResponse.json({ error: `Failed to perform ${body.operation}` }, { status: 500 })
  }
}