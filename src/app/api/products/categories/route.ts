import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/categories
 * Fetch all product categories from FFE Section Presets (synced with FFE management)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeProducts = searchParams.get('includeProducts') === 'true'

    const orgId = (session.user as any).orgId

    // Fetch FFE Section Presets as categories (synced with FFE management)
    const ffePresets = await prisma.fFESectionPreset.findMany({
      where: {
        orgId,
        isActive: true
      },
      orderBy: { order: 'asc' }
    })

    // Ensure ProductCategory records exist for all FFE presets and get their IDs
    const categoryMap: Record<string, string> = {}
    let productCounts: Record<string, number> = {}

    if (orgId) {
      for (const preset of ffePresets) {
        const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

        // Find or create corresponding ProductCategory
        let productCategory = await prisma.productCategory.findFirst({
          where: { orgId, slug }
        })

        if (productCategory) {
          // Update to keep in sync
          productCategory = await prisma.productCategory.update({
            where: { id: productCategory.id },
            data: {
              name: preset.name,
              order: preset.order,
              isActive: true
            }
          })
        } else {
          productCategory = await prisma.productCategory.create({
            data: {
              orgId,
              name: preset.name,
              slug,
              icon: preset.docCodePrefix,
              order: preset.order,
              isDefault: false,
              isActive: true
            }
          })
        }

        categoryMap[preset.id] = productCategory.id
      }

      // Get product counts if requested
      if (includeProducts) {
        const counts = await prisma.productCategory.findMany({
          where: { orgId, isActive: true },
          include: { _count: { select: { products: true } } }
        })
        productCounts = counts.reduce((acc, cat) => {
          acc[cat.name] = cat._count.products
          return acc
        }, {} as Record<string, number>)
      }
    }

    // Transform FFE presets to category format with ProductCategory IDs
    const categories = ffePresets.map(preset => {
      const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return {
        id: categoryMap[preset.id] || preset.id, // Use ProductCategory ID for product assignment
        presetId: preset.id, // Keep preset ID for reference
        name: preset.name,
        slug,
        icon: preset.docCodePrefix,
        color: null,
        parentId: null,
        order: preset.order,
        children: [],
        _count: includeProducts ? { products: productCounts[preset.name] || 0 } : undefined
      }
    })

    return NextResponse.json({
      categories,
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
 * Create a new category - also creates FFE Section Preset for sync
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, icon, color, parentId, docCodePrefix } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    // Generate doc code prefix from name (first 2-3 uppercase letters)
    const generatedPrefix = docCodePrefix || name.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase()

    const orgId = (session.user as any).orgId

    // Check for duplicate in FFE presets
    const existingPreset = await prisma.fFESectionPreset.findFirst({
      where: { orgId, name }
    })

    if (existingPreset) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.fFESectionPreset.aggregate({
      where: { orgId },
      _max: { order: true }
    })

    // Create FFE Section Preset (this is the source of truth)
    const preset = await prisma.fFESectionPreset.create({
      data: {
        orgId,
        name,
        docCodePrefix: generatedPrefix,
        order: (maxOrder._max.order || 0) + 1,
        isActive: true
      }
    })

    // Also create corresponding ProductCategory for product assignment
    const category = await prisma.productCategory.create({
      data: {
        orgId,
        name,
        slug,
        icon: generatedPrefix,
        color,
        parentId,
        order: preset.order,
        isDefault: false,
        isActive: true
      }
    })

    // Return in expected format - use ProductCategory ID for product assignment
    return NextResponse.json({
      category: {
        id: category.id,  // Use ProductCategory ID, not preset ID
        presetId: preset.id,
        name: preset.name,
        slug,
        icon: preset.docCodePrefix,
        color: null,
        parentId: null,
        order: preset.order,
        children: []
      }
    })
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
