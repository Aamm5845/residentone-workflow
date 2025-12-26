import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/category-markups
 * Get all category markups for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    const markups = await prisma.categoryMarkup.findMany({
      where: { orgId },
      orderBy: { category: 'asc' }
    })

    return NextResponse.json({ markups })
  } catch (error) {
    console.error('Error fetching category markups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category markups' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/category-markups
 * Create or update a category markup
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'PRINCIPAL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { category, markupPercentage, description } = body

    if (!category || markupPercentage === undefined) {
      return NextResponse.json(
        { error: 'Category and markup percentage are required' },
        { status: 400 }
      )
    }

    // Upsert - create or update
    const markup = await prisma.categoryMarkup.upsert({
      where: {
        orgId_category: {
          orgId,
          category
        }
      },
      create: {
        orgId,
        category,
        markupPercentage: parseFloat(markupPercentage),
        description
      },
      update: {
        markupPercentage: parseFloat(markupPercentage),
        description
      }
    })

    return NextResponse.json(markup)
  } catch (error) {
    console.error('Error saving category markup:', error)
    return NextResponse.json(
      { error: 'Failed to save category markup' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/category-markups
 * Delete a category markup
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'PRINCIPAL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    await prisma.categoryMarkup.delete({
      where: {
        orgId_category: {
          orgId,
          category
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category markup:', error)
    return NextResponse.json(
      { error: 'Failed to delete category markup' },
      { status: 500 }
    )
  }
}
