import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/suppliers/sync-currencies
 * Re-sync all item currencies based on their linked supplier's currency
 * This fixes any items that have incorrect currency values
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Get all suppliers for this org
    const suppliers = await prisma.supplier.findMany({
      where: { orgId },
      select: { id: true, currency: true, name: true }
    })

    let totalUpdated = 0
    const updates: { supplierName: string; currency: string; count: number }[] = []

    // For each supplier, update all their linked items to match their currency
    for (const supplier of suppliers) {
      if (supplier.currency) {
        const result = await prisma.roomFFEItem.updateMany({
          where: { supplierId: supplier.id },
          data: {
            tradePriceCurrency: supplier.currency,
            rrpCurrency: supplier.currency
          }
        })

        if (result.count > 0) {
          totalUpdated += result.count
          updates.push({
            supplierName: supplier.name,
            currency: supplier.currency,
            count: result.count
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${totalUpdated} items across ${updates.length} suppliers`,
      details: updates
    })

  } catch (error) {
    console.error('Error syncing currencies:', error)
    return NextResponse.json(
      { error: 'Failed to sync currencies' },
      { status: 500 }
    )
  }
}
