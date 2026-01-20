import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateComponentsRRP } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/ffe-specs
 * Get all FFE items that are marked as spec items for RFQ creation
 *
 * Query params:
 * - category: Filter by section name (e.g., "Plumbing", "Millwork")
 * - status: Filter by specStatus (e.g., "READY", "DRAFT")
 * - search: Search by name or description
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId

    // Parse query params
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get('category')
    const statusFilter = searchParams.get('status')
    const searchQuery = searchParams.get('search')
    const itemIds = searchParams.get('ids')?.split(',').filter(Boolean) // Optional: specific item IDs to fetch

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms for the project
    const rooms = await prisma.room.findMany({
      where: { projectId },
      select: { id: true, name: true }
    })

    const roomIds = rooms.map(r => r.id)

    if (roomIds.length === 0) {
      return NextResponse.json({ items: [], categories: [], total: 0 })
    }

    // Get FFE instances for these rooms
    // Structure: Room -> RoomFFEInstance -> RoomFFESection -> RoomFFEItem
    const instances = await prisma.roomFFEInstance.findMany({
      where: { roomId: { in: roomIds } },
      select: { id: true, roomId: true }
    })

    const instanceIds = instances.map(i => i.id)
    const instanceRoomMap = new Map(instances.map(i => [i.id, i.roomId]))
    const roomNameMap = new Map(rooms.map(r => [r.id, r.name]))

    if (instanceIds.length === 0) {
      return NextResponse.json({ items: [], categories: [], total: 0 })
    }

    // Get FFE sections for these instances
    const sections = await prisma.roomFFESection.findMany({
      where: { instanceId: { in: instanceIds } },
      select: { id: true, name: true, instanceId: true }
    })

    const sectionIds = sections.map(s => s.id)
    const sectionNameMap = new Map(sections.map(s => [s.id, s.name]))
    const sectionInstanceMap = new Map(sections.map(s => [s.id, s.instanceId]))

    if (sectionIds.length === 0) {
      return NextResponse.json({ items: [], categories: [], total: 0 })
    }

    // Build where clause for items
    // If specific item IDs are requested, fetch those
    // Otherwise, fetch all visible items that are in a quoteable state
    const whereClause: any = {
      sectionId: { in: sectionIds },
      visibility: 'VISIBLE'
    }

    if (itemIds && itemIds.length > 0) {
      // Fetch specific items by ID (for RFQ pre-selection)
      whereClause.id = { in: itemIds }
    } else {
      // Fetch items that are in a state ready for quoting
      // Include: SELECTED, RFQ_SENT (new), QUOTING (legacy), NEED_SAMPLE, BETTER_PRICE, NEED_TO_ORDER, or isSpecItem
      whereClause.OR = [
        { isSpecItem: true },
        { specStatus: { in: ['SELECTED', 'RFQ_SENT', 'QUOTING', 'NEED_SAMPLE', 'BETTER_PRICE', 'NEED_TO_ORDER'] } },
        { state: { in: ['SELECTED', 'CONFIRMED'] } }
      ]
    }

    // Filter by category (section name)
    if (categoryFilter) {
      const matchingSectionIds = sections
        .filter(s => s.name.toLowerCase() === categoryFilter.toLowerCase())
        .map(s => s.id)

      if (matchingSectionIds.length === 0) {
        return NextResponse.json({ items: [], categories: [], total: 0 })
      }
      whereClause.sectionId = { in: matchingSectionIds }
    }

    // Filter by spec status
    if (statusFilter) {
      whereClause.specStatus = statusFilter
    }

    // Search filter
    if (searchQuery) {
      whereClause.OR = [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { brand: { contains: searchQuery, mode: 'insensitive' } },
        { modelNumber: { contains: searchQuery, mode: 'insensitive' } }
      ]
    }

    // Get all FFE items that are spec items (including components)
    const items = await prisma.roomFFEItem.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        quantity: true,
        unitType: true,
        unitCost: true,
        tradePrice: true,
        rrp: true,
        rrpCurrency: true,
        markupPercent: true,
        supplierId: true,
        supplierName: true,
        supplierLink: true,
        brand: true,
        modelNumber: true,
        sku: true,
        color: true,
        finish: true,
        material: true,
        leadTime: true,
        images: true,
        specStatus: true,
        state: true,
        notes: true,
        sectionId: true,
        isSpecItem: true,
        clientApproved: true,
        clientApprovedAt: true,
        clientApprovedVia: true,
        // Include components for pricing
        components: {
          select: {
            id: true,
            name: true,
            modelNumber: true,
            image: true,
            price: true,
            quantity: true,
            order: true
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: [
        { sectionId: 'asc' },
        { order: 'asc' }
      ]
    })

    // Transform the data - get room name via section -> instance -> room
    const transformedItems = items.map(item => {
      const sectionName = sectionNameMap.get(item.sectionId) || 'Unknown'
      const instanceId = sectionInstanceMap.get(item.sectionId)
      const roomId = instanceId ? instanceRoomMap.get(instanceId) : null
      const roomName = roomId ? roomNameMap.get(roomId) : 'Unknown'

      // Calculate components total with markup (for pricing)
      const markupPercent = item.markupPercent ? Number(item.markupPercent) : 0
      const componentsTotal = calculateComponentsRRP(item.components || [], markupPercent)

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        category: sectionName, // Category comes from section name
        sectionName: sectionName,
        quantity: item.quantity || 1,
        unitType: item.unitType,
        unitCost: item.unitCost ? Number(item.unitCost) : null,
        tradePrice: item.tradePrice ? Number(item.tradePrice) : null,
        rrp: item.rrp ? Number(item.rrp) : null,
        rrpCurrency: item.rrpCurrency || 'CAD',
        markupPercent: markupPercent,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        supplierLink: item.supplierLink,
        brand: item.brand,
        modelNumber: item.modelNumber,
        sku: item.sku,
        color: item.color,
        finish: item.finish,
        material: item.material,
        leadTime: item.leadTime,
        images: item.images,
        specStatus: item.specStatus,
        state: item.state,
        notes: item.notes,
        roomName: roomName,
        isSpecItem: item.isSpecItem,
        clientApproved: item.clientApproved,
        clientApprovedAt: item.clientApprovedAt,
        clientApprovedVia: item.clientApprovedVia,
        // Components with pricing for invoice display
        components: (item.components || []).map(c => ({
          id: c.id,
          name: c.name,
          modelNumber: c.modelNumber,
          image: c.image,
          price: c.price ? Number(c.price) : null,
          priceWithMarkup: c.price ? Number(c.price) * (1 + markupPercent / 100) : null,
          quantity: c.quantity || 1
        })),
        componentsTotal: componentsTotal
      }
    })

    // Get unique categories for filtering UI
    const categories = [...new Set(transformedItems.map(item => item.category))].sort()

    return NextResponse.json({
      items: transformedItems,
      categories,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('Error fetching FFE specs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch FFE specs' },
      { status: 500 }
    )
  }
}
