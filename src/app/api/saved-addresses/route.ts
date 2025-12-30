import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/saved-addresses
 * Get all saved addresses for the organization
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    const addresses = await prisma.savedAddress.findMany({
      where: { orgId },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ addresses })
  } catch (error) {
    console.error('Error fetching saved addresses:', error)
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 })
  }
}

/**
 * POST /api/saved-addresses
 * Create a new saved address
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { name, street, city, province, postalCode, country = 'Canada', isDefault = false } = body

    if (!name || !street || !city || !province || !postalCode) {
      return NextResponse.json(
        { error: 'Name, street, city, province, and postal code are required' },
        { status: 400 }
      )
    }

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await prisma.savedAddress.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false }
      })
    }

    const address = await prisma.savedAddress.create({
      data: {
        orgId,
        name,
        street,
        city,
        province,
        postalCode,
        country,
        isDefault
      }
    })

    return NextResponse.json({ address })
  } catch (error) {
    console.error('Error creating saved address:', error)
    return NextResponse.json({ error: 'Failed to create address' }, { status: 500 })
  }
}

/**
 * PUT /api/saved-addresses
 * Update a saved address
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { id, name, street, city, province, postalCode, country, isDefault } = body

    if (!id) {
      return NextResponse.json({ error: 'Address ID required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.savedAddress.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await prisma.savedAddress.updateMany({
        where: { orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      })
    }

    const address = await prisma.savedAddress.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(street && { street }),
        ...(city && { city }),
        ...(province && { province }),
        ...(postalCode && { postalCode }),
        ...(country && { country }),
        ...(typeof isDefault === 'boolean' && { isDefault })
      }
    })

    return NextResponse.json({ address })
  } catch (error) {
    console.error('Error updating saved address:', error)
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
  }
}

/**
 * DELETE /api/saved-addresses
 * Delete a saved address
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Address ID required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.savedAddress.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    await prisma.savedAddress.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting saved address:', error)
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}
