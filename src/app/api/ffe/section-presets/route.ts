import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default presets to seed for new organizations
const DEFAULT_PRESETS = [
  { name: 'Plumbing', docCodePrefix: 'PL', description: 'Plumbing fixtures and fittings' },
  { name: 'Electrical', docCodePrefix: 'EL', description: 'Electrical fixtures and outlets' },
  { name: 'Millwork', docCodePrefix: 'MW', description: 'Custom millwork and cabinetry' },
  { name: 'Hardware', docCodePrefix: 'HW', description: 'Door and cabinet hardware' },
  { name: 'Lighting', docCodePrefix: 'LT', description: 'Light fixtures and controls' },
  { name: 'Flooring', docCodePrefix: 'FL', description: 'Floor materials and finishes' },
  { name: 'Window Treatments', docCodePrefix: 'WT', description: 'Blinds, drapes, and shades' },
  { name: 'Furniture', docCodePrefix: 'FN', description: 'Furniture pieces' },
  { name: 'Accessories', docCodePrefix: 'AC', description: 'Decorative accessories' },
  { name: 'Textiles', docCodePrefix: 'TX', description: 'Fabrics and soft furnishings' },
]

/**
 * GET /api/ffe/section-presets
 * List all section presets for the organization
 * Seeds default presets if none exist
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session or fallback to database lookup
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

    // Check if org has any presets
    let presets = await prisma.fFESectionPreset.findMany({
      where: { orgId },
      orderBy: { order: 'asc' }
    })

    // Seed default presets if none exist
    if (presets.length === 0) {
      await prisma.fFESectionPreset.createMany({
        data: DEFAULT_PRESETS.map((preset, index) => ({
          orgId,
          name: preset.name,
          docCodePrefix: preset.docCodePrefix,
          description: preset.description,
          order: index,
          isActive: true
        }))
      })

      presets = await prisma.fFESectionPreset.findMany({
        where: { orgId },
        orderBy: { order: 'asc' }
      })
    }

    return NextResponse.json({ presets })

  } catch (error) {
    console.error('Error fetching section presets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch section presets' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ffe/section-presets
 * Create a new section preset
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session or fallback to database lookup
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

    const body = await request.json()
    const { name, docCodePrefix, description, markupPercent } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!docCodePrefix?.trim()) {
      return NextResponse.json({ error: 'Doc code prefix is required' }, { status: 400 })
    }

    // Validate prefix format (1-3 uppercase letters)
    const prefix = docCodePrefix.toUpperCase().trim()
    if (!/^[A-Z]{1,3}$/.test(prefix)) {
      return NextResponse.json(
        { error: 'Prefix must be 1-3 uppercase letters' },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existingName = await prisma.fFESectionPreset.findFirst({
      where: { orgId, name: name.trim() }
    })
    if (existingName) {
      return NextResponse.json(
        { error: 'A preset with this name already exists' },
        { status: 400 }
      )
    }

    // Check for duplicate prefix
    const existingPrefix = await prisma.fFESectionPreset.findFirst({
      where: { orgId, docCodePrefix: prefix }
    })
    if (existingPrefix) {
      return NextResponse.json(
        { error: `Prefix "${prefix}" is already used by "${existingPrefix.name}"` },
        { status: 400 }
      )
    }

    // Get next order number
    const lastPreset = await prisma.fFESectionPreset.findFirst({
      where: { orgId },
      orderBy: { order: 'desc' }
    })
    const nextOrder = (lastPreset?.order ?? -1) + 1

    const preset = await prisma.fFESectionPreset.create({
      data: {
        orgId,
        name: name.trim(),
        docCodePrefix: prefix,
        description: description?.trim() || null,
        markupPercent: markupPercent !== undefined && markupPercent !== null && markupPercent !== ''
          ? parseFloat(markupPercent)
          : null,
        order: nextOrder,
        isActive: true
      }
    })

    return NextResponse.json({ preset })

  } catch (error) {
    console.error('Error creating section preset:', error)
    return NextResponse.json(
      { error: 'Failed to create section preset' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ffe/section-presets
 * Update a section preset
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session or fallback to database lookup
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

    const body = await request.json()
    const { id, name, docCodePrefix, description, markupPercent, isActive, order } = body

    if (!id) {
      return NextResponse.json({ error: 'Preset ID is required' }, { status: 400 })
    }

    // Verify preset belongs to org
    const existing = await prisma.fFESectionPreset.findFirst({
      where: { id, orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    const updateData: any = {}

    if (name !== undefined) {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      // Check for duplicate name (excluding current)
      const duplicateName = await prisma.fFESectionPreset.findFirst({
        where: { orgId, name: trimmedName, id: { not: id } }
      })
      if (duplicateName) {
        return NextResponse.json(
          { error: 'A preset with this name already exists' },
          { status: 400 }
        )
      }
      updateData.name = trimmedName
    }

    if (docCodePrefix !== undefined) {
      const prefix = docCodePrefix.toUpperCase().trim()
      if (!/^[A-Z]{1,3}$/.test(prefix)) {
        return NextResponse.json(
          { error: 'Prefix must be 1-3 uppercase letters' },
          { status: 400 }
        )
      }
      // Check for duplicate prefix (excluding current)
      const duplicatePrefix = await prisma.fFESectionPreset.findFirst({
        where: { orgId, docCodePrefix: prefix, id: { not: id } }
      })
      if (duplicatePrefix) {
        return NextResponse.json(
          { error: `Prefix "${prefix}" is already used by "${duplicatePrefix.name}"` },
          { status: 400 }
        )
      }
      updateData.docCodePrefix = prefix
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    if (order !== undefined) {
      updateData.order = order
    }

    if (markupPercent !== undefined) {
      updateData.markupPercent = markupPercent !== null && markupPercent !== ''
        ? parseFloat(markupPercent)
        : null
    }

    const preset = await prisma.fFESectionPreset.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ preset })

  } catch (error) {
    console.error('Error updating section preset:', error)
    return NextResponse.json(
      { error: 'Failed to update section preset' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ffe/section-presets
 * Delete a section preset (only if not in use)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session or fallback to database lookup
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Preset ID is required' }, { status: 400 })
    }

    // Verify preset belongs to org
    const existing = await prisma.fFESectionPreset.findFirst({
      where: { id, orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    // Check if preset is in use
    const sectionsUsingPreset = await prisma.roomFFESection.count({
      where: { presetId: id }
    })
    if (sectionsUsingPreset > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${sectionsUsingPreset} section(s) are using this preset` },
        { status: 400 }
      )
    }

    await prisma.fFESectionPreset.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting section preset:', error)
    return NextResponse.json(
      { error: 'Failed to delete section preset' },
      { status: 500 }
    )
  }
}
