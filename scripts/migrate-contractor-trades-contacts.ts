/**
 * Migration Script: Contractor Trades & Contacts
 *
 * This script:
 * 1. Maps existing free-text `specialty` values to the `trade` enum where possible
 * 2. Creates `ContractorContact` records from existing `contactName`/`email` on each contractor
 *    (marked as isPrimary: true)
 * 3. Does NOT remove original `contactName`/`email` fields (backward compat)
 *
 * Run with: npx tsx scripts/migrate-contractor-trades-contacts.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map of free-text specialty values (lowercased) to ContractorTrade enum values
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
  'fire': 'FIRE_PROTECTION',
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

async function main() {
  console.log('Starting contractor trade & contacts migration...\n')

  const contractors = await prisma.contractor.findMany({
    include: { contacts: true }
  })

  console.log(`Found ${contractors.length} contractors to process.\n`)

  let tradesMapped = 0
  let contactsCreated = 0
  let skippedTrades = 0
  let skippedContacts = 0

  for (const contractor of contractors) {
    // 1. Map specialty to trade (only if trade is not already set)
    if (!contractor.trade && contractor.specialty) {
      const normalized = contractor.specialty.trim().toLowerCase()
      const mappedTrade = SPECIALTY_TO_TRADE[normalized]

      if (mappedTrade) {
        await prisma.contractor.update({
          where: { id: contractor.id },
          data: { trade: mappedTrade as any }
        })
        console.log(`  ✓ Mapped "${contractor.specialty}" → ${mappedTrade} for "${contractor.businessName}"`)
        tradesMapped++
      } else {
        console.log(`  ? Could not map specialty "${contractor.specialty}" for "${contractor.businessName}" — set to OTHER`)
        await prisma.contractor.update({
          where: { id: contractor.id },
          data: { trade: 'OTHER' as any }
        })
        skippedTrades++
      }
    } else if (!contractor.trade && contractor.type === 'CONTRACTOR') {
      // General contractors without a trade get GENERAL_CONTRACTOR
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { trade: 'GENERAL_CONTRACTOR' as any }
      })
      console.log(`  ✓ Set GENERAL_CONTRACTOR for "${contractor.businessName}" (type=CONTRACTOR)`)
      tradesMapped++
    }

    // 2. Create ContractorContact from contactName/email (only if no contacts exist yet)
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
      console.log(`  ✓ Created primary contact for "${contractor.businessName}"`)
      contactsCreated++
    } else if (contractor.contacts.length > 0) {
      skippedContacts++
    }
  }

  console.log(`\n--- Migration Summary ---`)
  console.log(`Trades mapped:     ${tradesMapped}`)
  console.log(`Trades unmapped:   ${skippedTrades} (set to OTHER)`)
  console.log(`Contacts created:  ${contactsCreated}`)
  console.log(`Contacts skipped:  ${skippedContacts} (already had contacts)`)
  console.log(`Done!`)
}

main()
  .catch((e) => {
    console.error('Migration error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
