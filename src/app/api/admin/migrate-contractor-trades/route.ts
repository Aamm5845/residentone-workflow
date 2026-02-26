import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

const SPECIALTY_TO_TRADE: Record<string, string> = {
  'electrician': 'ELECTRICIAN',
  'electrical': 'ELECTRICIAN',
  'plumber': 'PLUMBER',
  'plumbing': 'PLUMBER',
  'hvac': 'HVAC',
  'heating': 'HVAC',
  'cooling': 'HVAC',
  'carpenter': 'CARPENTER',
  'carpentry': 'CARPENTER',
  'painter': 'PAINTER',
  'painting': 'PAINTER',
  'flooring': 'FLOORING',
  'floors': 'FLOORING',
  'tile': 'TILE',
  'tiling': 'TILE',
  'cabinetry': 'CABINETRY',
  'cabinets': 'CABINETRY',
  'cabinet': 'CABINETRY',
  'millwork': 'MILLWORK',
  'glazier': 'GLAZIER',
  'glazing': 'GLAZIER',
  'glass': 'GLAZIER',
  'roofer': 'ROOFER',
  'roofing': 'ROOFER',
  'mason': 'MASON',
  'masonry': 'MASON',
  'steel': 'STEEL_FABRICATOR',
  'steel fabrication': 'STEEL_FABRICATOR',
  'steel fabricator': 'STEEL_FABRICATOR',
  'drywall': 'DRYWALL',
  'insulation': 'INSULATION',
  'fire protection': 'FIRE_PROTECTION',
  'sprinkler': 'FIRE_PROTECTION',
  'landscape': 'LANDSCAPE',
  'landscaping': 'LANDSCAPE',
  'demolition': 'DEMOLITION',
  'demo': 'DEMOLITION',
  'audiovisual': 'AUDIOVISUAL',
  'audio visual': 'AUDIOVISUAL',
  'av': 'AUDIOVISUAL',
  'a/v': 'AUDIOVISUAL',
  'security': 'SECURITY_SYSTEMS',
  'security systems': 'SECURITY_SYSTEMS',
  'lighting': 'LIGHTING',
  'window treatment': 'WINDOW_TREATMENT',
  'window treatments': 'WINDOW_TREATMENT',
  'blinds': 'WINDOW_TREATMENT',
  'curtains': 'WINDOW_TREATMENT',
  'architect': 'ARCHITECT',
  'architecture': 'ARCHITECT',
  'interior designer': 'INTERIOR_DESIGNER',
  'interior design': 'INTERIOR_DESIGNER',
  'structural engineer': 'STRUCTURAL_ENGINEER',
  'structural': 'STRUCTURAL_ENGINEER',
  'mep engineer': 'MEP_ENGINEER',
  'mep': 'MEP_ENGINEER',
  'mechanical': 'MEP_ENGINEER',
  'civil engineer': 'CIVIL_ENGINEER',
  'civil': 'CIVIL_ENGINEER',
  'general contractor': 'GENERAL_CONTRACTOR',
  'general': 'GENERAL_CONTRACTOR',
  'gc': 'GENERAL_CONTRACTOR',
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractors = await prisma.contractor.findMany({
      where: { orgId: session.user.orgId },
      include: { contacts: true }
    })

    let tradesMapped = 0
    let contactsCreated = 0

    for (const contractor of contractors) {
      // Map specialty to trade if trade not set
      if (!contractor.trade) {
        let mappedTrade: string | null = null

        if (contractor.specialty) {
          const normalized = contractor.specialty.trim().toLowerCase()
          mappedTrade = SPECIALTY_TO_TRADE[normalized] || 'OTHER'
        } else if (contractor.type === 'CONTRACTOR') {
          mappedTrade = 'GENERAL_CONTRACTOR'
        }

        if (mappedTrade) {
          await prisma.contractor.update({
            where: { id: contractor.id },
            data: { trade: mappedTrade as any }
          })
          tradesMapped++
        }
      }

      // Create primary contact from contactName/email if no contacts exist
      if (contractor.contacts.length === 0 && (contractor.contactName || contractor.email)) {
        await prisma.contractorContact.create({
          data: {
            contractorId: contractor.id,
            name: contractor.contactName || contractor.businessName,
            email: contractor.email,
            phone: contractor.phone || null,
            isPrimary: true,
          }
        })
        contactsCreated++
      }
    }

    return NextResponse.json({
      success: true,
      total: contractors.length,
      tradesMapped,
      contactsCreated,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
