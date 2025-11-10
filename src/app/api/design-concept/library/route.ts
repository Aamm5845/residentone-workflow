import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// Disable caching for this API route
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/design-concept/library
 * Fetch universal design concept item library
 * Query params: category, search, includeInactive
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Build query
    const where: any = {}
    
    if (!includeInactive) {
      where.isActive = true
    }
    
    if (category) {
      where.category = category
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const items = await prisma.designConceptItemLibrary.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        icon: true,
        order: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Group by category for easier frontend consumption
    const categories: Record<string, any[]> = {}
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = []
      }
      categories[item.category].push(item)
    })

    return NextResponse.json({
      items,
      categories,
      total: items.length
    })

  } catch (error) {
    console.error('[Design Library] Error fetching library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch library' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/design-concept/library
 * Create new library item (admin only)
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
    const { name, category, description, icon, order } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    // Check for duplicates
    const existing = await prisma.designConceptItemLibrary.findFirst({
      where: { name, category }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Item with this name already exists in this category' },
        { status: 409 }
      )
    }

    // Get max order for category
    const maxOrder = await prisma.designConceptItemLibrary.findFirst({
      where: { category },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const item = await prisma.designConceptItemLibrary.create({
      data: {
        name,
        category,
        description: description || null,
        icon: icon || null,
        order: order !== undefined ? order : (maxOrder?.order || 0) + 1,
        isActive: true
      }
    })

    return NextResponse.json(item, { status: 201 })

  } catch (error) {
    console.error('[Design Library] Error creating item:', error)
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
