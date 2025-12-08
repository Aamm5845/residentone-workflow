import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/categories
 * Fetch all product categories (both global defaults and org-specific)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeProducts = searchParams.get('includeProducts') === 'true'
    const parentOnly = searchParams.get('parentOnly') === 'true'

    // Get both global categories (orgId = null) and org-specific ones
    const categories = await prisma.productCategory.findMany({
      where: {
        isActive: true,
        OR: [
          { orgId: null }, // Global/default categories
          { orgId: (session.user as any).orgId } // Org-specific
        ],
        ...(parentOnly ? { parentId: null } : {})
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        },
        ...(includeProducts ? {
          _count: {
            select: { products: true }
          }
        } : {})
      },
      orderBy: { order: 'asc' }
    })

    // Build hierarchical structure
    const parentCategories = categories.filter(c => !c.parentId)
    const categoryTree = parentCategories.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parentId === parent.id)
    }))

    return NextResponse.json({ 
      categories: categoryTree,
      total: categories.length 
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/categories
 * Create a new category (org-specific)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, icon, color, parentId } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const orgId = (session.user as any).orgId

    // Check for duplicate slug in org
    const existing = await prisma.productCategory.findFirst({
      where: { orgId, slug }
    })

    if (existing) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
    }

    // Get max order for this level
    const maxOrder = await prisma.productCategory.aggregate({
      where: { orgId, parentId: parentId || null },
      _max: { order: true }
    })

    const category = await prisma.productCategory.create({
      data: {
        orgId,
        name,
        slug,
        icon,
        color,
        parentId,
        order: (maxOrder._max.order || 0) + 1,
        isDefault: false,
        isActive: true
      }
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/products/categories
 * Update a category
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, icon, color, order, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId

    // Verify category exists and belongs to org (or is editable)
    const existing = await prisma.productCategory.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Only allow editing org-specific categories, not global defaults
    if (existing.orgId !== orgId && existing.isDefault) {
      return NextResponse.json({ error: 'Cannot edit default categories' }, { status: 403 })
    }

    const updateData: any = {}
    if (name !== undefined) {
      updateData.name = name
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }
    if (icon !== undefined) updateData.icon = icon
    if (color !== undefined) updateData.color = color
    if (order !== undefined) updateData.order = order
    if (isActive !== undefined) updateData.isActive = isActive

    const category = await prisma.productCategory.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/categories
 * Delete a category (only org-specific, not defaults)
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

    // Verify category exists and is org-specific
    const existing = await prisma.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (existing.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default categories' }, { status: 403 })
    }

    if (existing.orgId !== orgId) {
      return NextResponse.json({ error: 'Cannot delete this category' }, { status: 403 })
    }

    if (existing._count.products > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category with products. Move or delete products first.' 
      }, { status: 400 })
    }

    if (existing._count.children > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category with subcategories. Delete subcategories first.' 
      }, { status: 400 })
    }

    await prisma.productCategory.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
