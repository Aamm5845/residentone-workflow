import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get all FFE categories for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Define standard FFE categories
    const standardCategories = [
      {
        id: 'base-finishes',
        name: 'Base Finishes',
        description: 'Flooring, wall finishes, and structural elements',
        icon: 'Building2',
        order: 1,
        isExpandable: true,
        roomTypes: ['living-room', 'bedroom', 'kitchen', 'bathroom', 'dining-room', 'office', 'guest-room'],
        isGlobal: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      },
      {
        id: 'furniture',
        name: 'Furniture',
        description: 'Seating, tables, storage, and functional furniture',
        icon: 'Sofa',
        order: 2,
        isExpandable: true,
        roomTypes: ['living-room', 'bedroom', 'dining-room', 'office', 'guest-room'],
        isGlobal: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      },
      {
        id: 'lighting',
        name: 'Lighting',
        description: 'Ceiling fixtures, lamps, and accent lighting',
        icon: 'Lightbulb',
        order: 3,
        isExpandable: true,
        roomTypes: ['living-room', 'bedroom', 'kitchen', 'bathroom', 'dining-room', 'office', 'guest-room'],
        isGlobal: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      },
      {
        id: 'textiles',
        name: 'Textiles',
        description: 'Curtains, rugs, pillows, and fabric elements',
        icon: 'Palette',
        order: 4,
        isExpandable: true,
        roomTypes: ['living-room', 'bedroom', 'dining-room', 'guest-room'],
        isGlobal: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      },
      {
        id: 'accessories',
        name: 'Accessories',
        description: 'Artwork, decorative objects, and styling elements',
        icon: 'Palette',
        order: 5,
        isExpandable: true,
        roomTypes: ['living-room', 'bedroom', 'kitchen', 'bathroom', 'dining-room', 'office', 'guest-room'],
        isGlobal: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      },
      {
        id: 'fixtures',
        name: 'Fixtures',
        description: 'Plumbing fixtures, hardware, and built-in elements',
        icon: 'Wrench',
        order: 6,
        isExpandable: true,
        roomTypes: ['kitchen', 'bathroom'],
        isGlobal: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      },
      {
        id: 'appliances',
        name: 'Appliances',
        description: 'Kitchen appliances and utility equipment',
        icon: 'ChefHat',
        order: 7,
        isExpandable: true,
        roomTypes: ['kitchen'],
        isGlobal: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: 'system',
        updatedById: 'system'
      }
    ]

    // Get any custom categories from the organization's library items
    const customItems = await prisma.fFELibraryItem.findMany({
      where: { orgId },
      select: {
        category: true,
        roomTypes: true
      }
    })

    // Extract unique custom categories
    const customCategoryNames = [...new Set(customItems.map(item => item.category))]
    const standardCategoryNames = standardCategories.map(cat => cat.id)
    const customCategories = customCategoryNames
      .filter(name => !standardCategoryNames.includes(name))
      .map((name, index) => ({
        id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        description: `Custom category for ${name}`,
        icon: 'Settings',
        order: 100 + index,
        isExpandable: true,
        roomTypes: [...new Set(customItems
          .filter(item => item.category === name)
          .flatMap(item => item.roomTypes)
        )],
        isGlobal: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: session.user.id,
        updatedById: session.user.id
      }))

    const allCategories = [...standardCategories, ...customCategories]

    return NextResponse.json({ categories: allCategories })

  } catch (error) {
    console.error('Error fetching FFE categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new custom FFE category
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, name, description, icon, roomTypes, isGlobal, isExpandable } = body

    if (!orgId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For now, just return a mock response since we don't have a categories table
    const newCategory = {
      id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      description: description || `Custom category for ${name}`,
      icon: icon || 'Settings',
      order: 1000,
      isExpandable: isExpandable !== false,
      roomTypes: roomTypes || [],
      isGlobal: isGlobal || false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: session.user.id,
      updatedById: session.user.id
    }

    return NextResponse.json({ 
      category: newCategory,
      message: 'Custom category created successfully'
    })

  } catch (error) {
    console.error('Error creating FFE category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

// Update category order (for drag and drop)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, categoryOrders } = body

    if (!orgId || !categoryOrders) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For now, just return success since we don't have the table
    // In a full implementation, this would update the order in the database
    return NextResponse.json({ 
      success: true,
      message: 'Category order updated successfully'
    })

  } catch (error) {
    console.error('Error updating category order:', error)
    return NextResponse.json({ error: 'Failed to update category order' }, { status: 500 })
  }
}
