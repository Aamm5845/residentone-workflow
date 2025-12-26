import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default categories to seed for new organizations
const DEFAULT_CATEGORIES = [
  { name: 'Plumbing', icon: 'Wrench', color: 'blue', sortOrder: 1 },
  { name: 'Lighting', icon: 'Lightbulb', color: 'amber', sortOrder: 2 },
  { name: 'Furniture', icon: 'Sofa', color: 'emerald', sortOrder: 3 },
  { name: 'Flooring', icon: 'Layers', color: 'orange', sortOrder: 4 },
  { name: 'Hardware', icon: 'CircleDot', color: 'zinc', sortOrder: 5 },
  { name: 'Appliances', icon: 'Package', color: 'indigo', sortOrder: 6 },
  { name: 'Textiles', icon: 'Shirt', color: 'pink', sortOrder: 7 },
  { name: 'Other', icon: 'MoreHorizontal', color: 'gray', sortOrder: 99 },
]

/**
 * GET /api/supplier-categories
 * Get all supplier categories for the organization
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    // Check if org has any categories, if not seed defaults
    let categories = await prisma.supplierCategory.findMany({
      where: {
        orgId,
        isActive: true
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { suppliers: { where: { isActive: true } } }
        }
      }
    })

    // Seed default categories if none exist
    if (categories.length === 0) {
      await prisma.supplierCategory.createMany({
        data: DEFAULT_CATEGORIES.map(cat => ({
          ...cat,
          orgId,
          isDefault: true
        }))
      })

      categories = await prisma.supplierCategory.findMany({
        where: {
          orgId,
          isActive: true
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { suppliers: { where: { isActive: true } } }
          }
        }
      })
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching supplier categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-categories
 * Create a new supplier category
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, icon, color } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId

    // Check if category with same name already exists
    const existing = await prisma.supplierCategory.findFirst({
      where: {
        orgId,
        name: name.trim(),
        isActive: true
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 })
    }

    // Get the highest sort order
    const maxSort = await prisma.supplierCategory.findFirst({
      where: { orgId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    const category = await prisma.supplierCategory.create({
      data: {
        orgId,
        name: name.trim(),
        icon: icon || 'Tag',
        color: color || 'slate',
        sortOrder: (maxSort?.sortOrder || 0) + 1,
        isDefault: false
      },
      include: {
        _count: {
          select: { suppliers: { where: { isActive: true } } }
        }
      }
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error creating supplier category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/supplier-categories
 * Update a supplier category
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, icon, color, sortOrder } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId

    // Verify category belongs to org
    const existing = await prisma.supplierCategory.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for duplicate name
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.supplierCategory.findFirst({
        where: {
          orgId,
          name: name.trim(),
          isActive: true,
          id: { not: id }
        }
      })

      if (duplicate) {
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 })
      }
    }

    const category = await prisma.supplierCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(sortOrder !== undefined && { sortOrder })
      },
      include: {
        _count: {
          select: { suppliers: { where: { isActive: true } } }
        }
      }
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error updating supplier category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/supplier-categories
 * Delete a supplier category (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId

    // Verify category belongs to org
    const existing = await prisma.supplierCategory.findFirst({
      where: { id, orgId },
      include: {
        _count: {
          select: { suppliers: { where: { isActive: true } } }
        }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if category has suppliers
    if (existing._count.suppliers > 0) {
      return NextResponse.json({ 
        error: `Cannot delete category with ${existing._count.suppliers} supplier(s). Reassign suppliers first.` 
      }, { status: 400 })
    }

    // Soft delete
    await prisma.supplierCategory.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting supplier category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}

