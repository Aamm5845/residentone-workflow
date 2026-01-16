import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/organization
 * Get organization business profile settings
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session or fetch from database
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

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        businessName: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        businessCountry: true,
        businessPhone: true,
        businessEmail: true,
        neqNumber: true,
        gstNumber: true,
        qstNumber: true,
        defaultGstRate: true,
        defaultQstRate: true,
        wireInstructions: true,
        checkInstructions: true,
        etransferEmail: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Error fetching organization settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/organization
 * Update organization business profile settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session or fetch from database
    let orgId = (session.user as any).orgId

    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true, role: true }
      })
      orgId = user?.orgId

      // Check if user has permission to update settings
      if (user?.role !== 'ADMIN' && user?.role !== 'PRINCIPAL') {
        return NextResponse.json(
          { error: 'Only admins can update organization settings' },
          { status: 403 }
        )
      }
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const body = await request.json()

    // Validate and sanitize input
    const updateData: any = {}

    // Business Profile fields
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl
    if (body.businessName !== undefined) updateData.businessName = body.businessName
    if (body.businessAddress !== undefined) updateData.businessAddress = body.businessAddress
    if (body.businessCity !== undefined) updateData.businessCity = body.businessCity
    if (body.businessProvince !== undefined) updateData.businessProvince = body.businessProvince
    if (body.businessPostal !== undefined) updateData.businessPostal = body.businessPostal
    if (body.businessCountry !== undefined) updateData.businessCountry = body.businessCountry
    if (body.businessPhone !== undefined) updateData.businessPhone = body.businessPhone
    if (body.businessEmail !== undefined) updateData.businessEmail = body.businessEmail

    // Tax Registration Numbers
    if (body.neqNumber !== undefined) updateData.neqNumber = body.neqNumber
    if (body.gstNumber !== undefined) updateData.gstNumber = body.gstNumber
    if (body.qstNumber !== undefined) updateData.qstNumber = body.qstNumber

    // Tax Rates
    if (body.defaultGstRate !== undefined) {
      const gstRate = parseFloat(body.defaultGstRate)
      if (!isNaN(gstRate) && gstRate >= 0 && gstRate <= 100) {
        updateData.defaultGstRate = gstRate
      }
    }
    if (body.defaultQstRate !== undefined) {
      const qstRate = parseFloat(body.defaultQstRate)
      if (!isNaN(qstRate) && qstRate >= 0 && qstRate <= 100) {
        updateData.defaultQstRate = qstRate
      }
    }

    // Payment Instructions
    if (body.wireInstructions !== undefined) updateData.wireInstructions = body.wireInstructions
    if (body.checkInstructions !== undefined) updateData.checkInstructions = body.checkInstructions
    if (body.etransferEmail !== undefined) updateData.etransferEmail = body.etransferEmail

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        businessName: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        businessCountry: true,
        businessPhone: true,
        businessEmail: true,
        neqNumber: true,
        gstNumber: true,
        qstNumber: true,
        defaultGstRate: true,
        defaultQstRate: true,
        wireInstructions: true,
        checkInstructions: true,
        etransferEmail: true,
      }
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Error updating organization settings:', error)
    return NextResponse.json(
      { error: 'Failed to update organization settings' },
      { status: 500 }
    )
  }
}
