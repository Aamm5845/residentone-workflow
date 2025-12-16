import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/suppliers/search
 * Search suppliers by name for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    
    if (!query.trim()) {
      return NextResponse.json({ suppliers: [] })
    }

    const orgId = (session.user as any).orgId

    const suppliers = await prisma.supplier.findMany({
      where: {
        orgId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { contactName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        website: true,
        logo: true
      },
      orderBy: { name: 'asc' },
      take: 20 // Limit results
    })

    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error('Error searching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to search suppliers' },
      { status: 500 }
    )
  }
}

