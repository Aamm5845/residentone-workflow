import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// Disable caching for this API route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Default categories that should be available
const DEFAULT_CATEGORIES = [
  { key: 'furniture', name: 'Furniture', icon: 'Sofa', order: 1 },
  { key: 'plumbing', name: 'Plumbing Fixtures', icon: 'Droplet', order: 2 },
  { key: 'lighting', name: 'Lighting', icon: 'Lightbulb', order: 3 },
  { key: 'textiles', name: 'Textiles & Soft Goods', icon: 'Shirt', order: 4 },
  { key: 'decor', name: 'Decor & Accessories', icon: 'Flower', order: 5 },
  { key: 'appliances', name: 'Appliances', icon: 'Microwave', order: 6 },
  { key: 'hardware', name: 'Hardware & Details', icon: 'Wrench', order: 7 },
  { key: 'materials', name: 'Materials & Finishes', icon: 'Paintbrush', order: 8 },
]

/**
 * GET /api/design-concept/categories
 * Fetch all categories (default + custom)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Ensure default categories exist
    await ensureDefaultCategories()

    // Fetch all categories
    const where: any = {}
    if (!includeInactive) {
      where.isActive = true
    }

    const categories = await prisma.designConceptCategory.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    // Create a map for easier frontend consumption
    const categoryMap: Record<string, any> = {}
    categories.forEach(cat => {
      categoryMap[cat.key] = cat
    })

    return NextResponse.json({
      categories,
      categoryMap,
      total: categories.length
    })

  } catch (error) {
    console.error('[Design Categories] Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/design-concept/categories
 * Create new custom category (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { key, name, icon, order } = body

    if (!key || !name) {
      return NextResponse.json(
        { error: 'Key and name are required' },
        { status: 400 }
      )
    }

    // Validate key format (lowercase, alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(key)) {
      return NextResponse.json(
        { error: 'Key must be lowercase alphanumeric with underscores only' },
        { status: 400 }
      )
    }

    // Check for duplicate key
    const existing = await prisma.designConceptCategory.findUnique({
      where: { key }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Category with this key already exists' },
        { status: 409 }
      )
    }

    // Get max order if order not specified
    let finalOrder = order
    if (finalOrder === undefined) {
      const maxOrder = await prisma.designConceptCategory.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true }
      })
      finalOrder = (maxOrder?.order || 0) + 1
    }

    // Create the category
    const category = await prisma.designConceptCategory.create({
      data: {
        key,
        name,
        icon: icon || null,
        order: finalOrder,
        isDefault: false,
        isActive: true
      }
    })

    return NextResponse.json(category, { status: 201 })

  } catch (error) {
    console.error('[Design Categories] Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

/**
 * Ensure default categories exist in database
 */
async function ensureDefaultCategories() {
  // Use upsert to avoid race conditions
  await Promise.all(
    DEFAULT_CATEGORIES.map(defaultCat =>
      prisma.designConceptCategory.upsert({
        where: { key: defaultCat.key },
        create: {
          ...defaultCat,
          isDefault: true,
          isActive: true
        },
        update: {} // Don't update if exists
      })
    )
  )
}
