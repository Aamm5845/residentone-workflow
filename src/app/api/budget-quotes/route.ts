import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/budget-quotes
 * List budget quotes for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const where: any = { orgId }
    if (projectId) {
      where.projectId = projectId
    }

    const budgetQuotes = await prisma.budgetQuote.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(budgetQuotes)
  } catch (error) {
    console.error('Error fetching budget quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budget quotes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/budget-quotes
 * Create a new budget quote
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const body = await request.json()

    const {
      projectId,
      title,
      description,
      itemIds,
      supplierQuoteIds = [],
      estimatedTotal,
      markupPercent,
      currency = 'CAD',
      includeTax = true,
      includedServices = [],
      clientEmail,
      expiresAt
    } = body

    if (!projectId || !title || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'projectId, title, and itemIds are required' },
        { status: 400 }
      )
    }

    if (estimatedTotal === undefined || estimatedTotal === null) {
      return NextResponse.json(
        { error: 'estimatedTotal is required' },
        { status: 400 }
      )
    }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create budget quote
    const budgetQuote = await prisma.budgetQuote.create({
      data: {
        orgId,
        projectId,
        title,
        description,
        itemIds,
        supplierQuoteIds,
        estimatedTotal,
        markupPercent: markupPercent || null,
        currency,
        includeTax,
        includedServices,
        clientEmail,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: userId
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json(budgetQuote, { status: 201 })
  } catch (error) {
    console.error('Error creating budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to create budget quote' },
      { status: 500 }
    )
  }
}
