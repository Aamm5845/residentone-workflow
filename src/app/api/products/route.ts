import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products
 * Fetch products from the library with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const status = searchParams.get('status') || 'ACTIVE'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Get orgId from session, with fallback to database lookup
    let orgId = (session.user as any).orgId

    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      orgId = user?.orgId
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // Build where clause
    const where: any = {
      orgId,
      status
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get total count
    const total = await prisma.productLibraryItem.count({ where })

    // Get products
    const products = await prisma.productLibraryItem.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            parent: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: { roomItems: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products
 * Create a new product in the library
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      categoryId,
      brand,
      sku,
      modelNumber,
      color,
      finish,
      material,
      width,
      height,
      depth,
      length,
      dimensionUnit,
      rrp,
      tradePrice,
      currency,
      supplierName,
      supplierPhone,
      supplierEmail,
      supplierAddress,
      supplierLink,
      leadTime,
      isTaxable,
      images,
      thumbnailUrl,
      attachments,
      tags,
      customFields,
      notes
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    // Get orgId and userId from session, with fallback to database lookup
    let orgId = (session.user as any).orgId
    let userId = (session.user as any).id

    // If userId is missing, fetch from database
    if (!userId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })
      if (user) {
        userId = user.id
        orgId = orgId || user.orgId
      }
    }

    if (!orgId || !userId) {
      console.error('Missing orgId or userId:', { orgId, userId, email: session.user.email })
      return NextResponse.json({ error: 'Session data incomplete' }, { status: 400 })
    }

    const product = await prisma.productLibraryItem.create({
      data: {
        orgId,
        name,
        description,
        categoryId,
        brand,
        sku,
        modelNumber,
        color,
        finish,
        material,
        width,
        height,
        depth,
        length,
        dimensionUnit: dimensionUnit || 'cm',
        rrp: rrp ? parseFloat(rrp) : null,
        tradePrice: tradePrice ? parseFloat(tradePrice) : null,
        currency: currency || 'GBP',
        supplierName,
        supplierPhone,
        supplierEmail,
        supplierAddress,
        supplierLink,
        leadTime,
        isTaxable: isTaxable !== undefined ? isTaxable : true,
        images: images || [],
        thumbnailUrl: thumbnailUrl || (images?.length > 0 ? images[0] : null),
        attachments,
        tags: tags || [],
        customFields,
        notes,
        status: 'ACTIVE',
        createdById: userId,
        updatedById: userId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/products
 * Update a product in the library
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateFields } = body

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Get orgId and userId from session, with fallback to database lookup
    let orgId = (session.user as any).orgId
    let userId = (session.user as any).id

    if (!userId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })
      if (user) {
        userId = user.id
        orgId = orgId || user.orgId
      }
    }

    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Session data incomplete' }, { status: 400 })
    }

    // Verify product belongs to org
    const existing = await prisma.productLibraryItem.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Only allow specific updatable fields (filter out read-only and relation fields)
    const allowedFields = [
      'name', 'description', 'categoryId', 'brand', 'sku', 'modelNumber',
      'color', 'finish', 'material', 'width', 'height', 'depth', 'length',
      'dimensionUnit', 'rrp', 'tradePrice', 'currency', 'supplierName',
      'supplierPhone', 'supplierEmail', 'supplierAddress', 'supplierLink',
      'leadTime', 'isTaxable', 'images', 'thumbnailUrl', 'attachments',
      'tags', 'customFields', 'notes', 'status'
    ]

    const updateData: any = { updatedById: userId }

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        updateData[field] = updateFields[field]
      }
    }

    // Parse numeric fields
    if (updateData.rrp !== undefined) {
      updateData.rrp = updateData.rrp ? parseFloat(updateData.rrp) : null
    }
    if (updateData.tradePrice !== undefined) {
      updateData.tradePrice = updateData.tradePrice ? parseFloat(updateData.tradePrice) : null
    }

    const product = await prisma.productLibraryItem.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products
 * Archive or delete a product
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Get orgId and userId from session, with fallback to database lookup
    let orgId = (session.user as any).orgId
    let userId = (session.user as any).id

    if (!userId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      })
      if (user) {
        userId = user.id
        orgId = orgId || user.orgId
      }
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Session data incomplete' }, { status: 400 })
    }

    // Verify product belongs to org
    const existing = await prisma.productLibraryItem.findFirst({
      where: { id, orgId },
      include: { _count: { select: { roomItems: true } } }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (permanent) {
      // Check if product is used in any rooms
      if (existing._count.roomItems > 0) {
        return NextResponse.json({
          error: 'Cannot delete product that is used in rooms. Archive it instead.'
        }, { status: 400 })
      }

      await prisma.productLibraryItem.delete({
        where: { id }
      })
    } else {
      // Archive the product
      await prisma.productLibraryItem.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          updatedById: userId
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}
