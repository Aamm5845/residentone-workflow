import { PrismaClient, RoomType } from '@prisma/client'

const prisma = new PrismaClient()

// Default sections that apply to most room types
const DEFAULT_SECTIONS = [
  {
    name: 'Flooring',
    description: 'Floor coverings, materials, and treatments',
    icon: '🏢',
    color: '#8B5A2B',
    defaultOrder: 1,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'BATHROOM', 'MASTER_BATHROOM', 'POWDER_ROOM', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM', 'FOYER', 'ENTRANCE', 'HALLWAY'] as RoomType[]
  },
  {
    name: 'Wall Treatments',
    description: 'Paint, wallpaper, paneling, and wall finishes',
    icon: '🎨',
    color: '#4A90E2',
    defaultOrder: 2,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'BATHROOM', 'MASTER_BATHROOM', 'POWDER_ROOM', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM', 'FOYER'] as RoomType[]
  },
  {
    name: 'Ceiling',
    description: 'Ceiling finishes, moldings, and treatments',
    icon: '⬆️',
    color: '#F5A623',
    defaultOrder: 3,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'BATHROOM', 'MASTER_BATHROOM', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM'] as RoomType[]
  },
  {
    name: 'Lighting',
    description: 'Light fixtures, switches, and electrical',
    icon: '💡',
    color: '#F8E71C',
    defaultOrder: 4,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'BATHROOM', 'MASTER_BATHROOM', 'POWDER_ROOM', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM', 'FOYER', 'ENTRANCE', 'HALLWAY'] as RoomType[]
  },
  {
    name: 'Furniture',
    description: 'Built-in and freestanding furniture pieces',
    icon: '🛋️',
    color: '#8B4513',
    defaultOrder: 5,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM', 'FOYER'] as RoomType[]
  },
  {
    name: 'Plumbing',
    description: 'Fixtures, fittings, and plumbing elements',
    icon: '🚿',
    color: '#50E3C2',
    defaultOrder: 6,
    applicableRoomTypes: ['BATHROOM', 'MASTER_BATHROOM', 'POWDER_ROOM', 'KITCHEN', 'LAUNDRY_ROOM'] as RoomType[]
  },
  {
    name: 'Window Treatments',
    description: 'Curtains, blinds, shutters, and window coverings',
    icon: '🪟',
    color: '#7ED321',
    defaultOrder: 7,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM'] as RoomType[]
  },
  {
    name: 'Accessories',
    description: 'Decorative accessories, art, and finishing touches',
    icon: '🎭',
    color: '#BD10E0',
    defaultOrder: 8,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN', 'BATHROOM', 'MASTER_BATHROOM', 'OFFICE', 'STUDY_ROOM', 'FAMILY_ROOM', 'FOYER'] as RoomType[]
  },
  {
    name: 'Hardware',
    description: 'Door hardware, cabinet pulls, and functional hardware',
    icon: '🔧',
    color: '#9013FE',
    defaultOrder: 9,
    applicableRoomTypes: ['BEDROOM', 'MASTER_BEDROOM', 'GUEST_BEDROOM', 'KITCHEN', 'BATHROOM', 'MASTER_BATHROOM', 'POWDER_ROOM', 'OFFICE', 'STUDY_ROOM'] as RoomType[]
  }
]

// Sample template items for different sections
const SAMPLE_BEDROOM_ITEMS = {
  'Flooring': [
    { name: 'Bedroom Flooring', description: 'Primary floor covering for bedroom', isRequired: true, order: 1 },
    { name: 'Area Rug', description: 'Accent rug for bedroom', isRequired: false, order: 2 }
  ],
  'Wall Treatments': [
    { name: 'Wall Paint', description: 'Primary wall color', isRequired: true, order: 1 },
    { name: 'Accent Wall Treatment', description: 'Special wall treatment for accent wall', isRequired: false, order: 2 }
  ],
  'Lighting': [
    { name: 'Overhead Lighting', description: 'Main ceiling light fixture', isRequired: true, order: 1 },
    { name: 'Bedside Lamps', description: 'Table lamps for nightstands', isRequired: false, order: 2 },
    { name: 'Reading Lights', description: 'Wall-mounted or pendant reading lights', isRequired: false, order: 3 }
  ],
  'Furniture': [
    { name: 'Bed Frame', description: 'Primary bed structure', isRequired: true, order: 1 },
    { name: 'Nightstands', description: 'Bedside tables', isRequired: false, order: 2 },
    { name: 'Dresser', description: 'Clothing storage dresser', isRequired: false, order: 3 },
    { name: 'Seating', description: 'Chair or bench for bedroom', isRequired: false, order: 4 }
  ],
  'Window Treatments': [
    { name: 'Window Covering', description: 'Curtains, blinds, or shades', isRequired: false, order: 1 }
  ],
  'Accessories': [
    { name: 'Bedding', description: 'Sheets, pillows, and bed linens', isRequired: false, order: 1 },
    { name: 'Artwork', description: 'Wall art and decorative pieces', isRequired: false, order: 2 },
    { name: 'Mirror', description: 'Bedroom mirror', isRequired: false, order: 3 }
  ]
}

const SAMPLE_BATHROOM_ITEMS = {
  'Flooring': [
    { name: 'Floor Tile', description: 'Bathroom floor covering', isRequired: true, order: 1 }
  ],
  'Wall Treatments': [
    { name: 'Wall Tile/Paint', description: 'Primary wall treatment', isRequired: true, order: 1 },
    { name: 'Accent Tile', description: 'Decorative wall tile accent', isRequired: false, order: 2 }
  ],
  'Lighting': [
    { name: 'Vanity Lighting', description: 'Mirror and vanity lighting', isRequired: true, order: 1 },
    { name: 'General Lighting', description: 'Overhead or ambient lighting', isRequired: true, order: 2 }
  ],
  'Plumbing': [
    { name: 'Toilet', description: 'Toilet fixture', isRequired: true, order: 1 },
    { name: 'Vanity & Sink', description: 'Vanity cabinet and sink', isRequired: true, order: 2 },
    { name: 'Bathtub', description: 'Bathtub fixture', isRequired: false, order: 3 },
    { name: 'Shower', description: 'Shower fixture and enclosure', isRequired: false, order: 4 },
    { name: 'Faucets', description: 'All faucets and fixtures', isRequired: true, order: 5 }
  ],
  'Accessories': [
    { name: 'Mirror', description: 'Bathroom mirror', isRequired: true, order: 1 },
    { name: 'Towel Bars', description: 'Towel storage and hanging', isRequired: false, order: 2 },
    { name: 'Bath Accessories', description: 'Soap dispensers, toilet paper holders', isRequired: false, order: 3 }
  ],
  'Hardware': [
    { name: 'Cabinet Hardware', description: 'Vanity cabinet pulls and knobs', isRequired: false, order: 1 },
    { name: 'Door Hardware', description: 'Bathroom door handle and lock', isRequired: false, order: 2 }
  ]
}

const SAMPLE_KITCHEN_ITEMS = {
  'Flooring': [
    { name: 'Kitchen Flooring', description: 'Primary floor covering for kitchen', isRequired: true, order: 1 }
  ],
  'Wall Treatments': [
    { name: 'Wall Paint', description: 'Kitchen wall color', isRequired: true, order: 1 },
    { name: 'Backsplash', description: 'Kitchen backsplash tile/material', isRequired: true, order: 2 }
  ],
  'Lighting': [
    { name: 'General Lighting', description: 'Main kitchen lighting', isRequired: true, order: 1 },
    { name: 'Task Lighting', description: 'Under-cabinet and prep lighting', isRequired: false, order: 2 },
    { name: 'Pendant Lights', description: 'Island or dining area pendants', isRequired: false, order: 3 }
  ],
  'Furniture': [
    { name: 'Kitchen Cabinets', description: 'Upper and lower cabinets', isRequired: true, order: 1 },
    { name: 'Kitchen Island', description: 'Center island or peninsula', isRequired: false, order: 2 },
    { name: 'Bar Stools', description: 'Counter height seating', isRequired: false, order: 3 }
  ],
  'Plumbing': [
    { name: 'Kitchen Sink', description: 'Primary kitchen sink', isRequired: true, order: 1 },
    { name: 'Kitchen Faucet', description: 'Main kitchen faucet', isRequired: true, order: 2 }
  ],
  'Hardware': [
    { name: 'Cabinet Hardware', description: 'Cabinet pulls, knobs, and handles', isRequired: true, order: 1 },
    { name: 'Appliance Pulls', description: 'Refrigerator and appliance hardware', isRequired: false, order: 2 }
  ]
}

async function seedFFESectionLibrary() {
  console.log('🌱 Seeding FFE Section Library...')
  
  for (const section of DEFAULT_SECTIONS) {
    await prisma.fFESectionLibrary.upsert({
      where: { name: section.name },
      update: section,
      create: section
    })
  }
  
  console.log(`✅ Seeded ${DEFAULT_SECTIONS.length} default sections`)
}

async function seedSampleTemplates(orgId: string, userId: string) {
  console.log('🌱 Creating sample FFE templates...')
  
  // Create bedroom template
  const bedroomTemplate = await prisma.fFETemplate.create({
    data: {
      orgId,
      roomType: 'MASTER_BEDROOM',
      name: 'Standard Master Bedroom',
      description: 'Complete FFE template for master bedroom with all essential items',
      status: 'ACTIVE',
      isDefault: true,
      createdById: userId,
      updatedById: userId,
      sections: {
        create: Object.entries(SAMPLE_BEDROOM_ITEMS).map(([sectionName, items], sectionIndex) => ({
          name: sectionName,
          description: `${sectionName} items for bedroom`,
          order: sectionIndex + 1,
          items: {
            create: items.map(item => ({
              ...item,
              defaultState: item.isRequired ? 'SELECTED' : 'PENDING',
              estimatedCost: Math.floor(Math.random() * 1000) + 100, // Random cost for demo
            }))
          }
        }))
      }
    }
  })
  
  // Create bathroom template  
  const bathroomTemplate = await prisma.fFETemplate.create({
    data: {
      orgId,
      roomType: 'MASTER_BATHROOM',
      name: 'Standard Master Bathroom',
      description: 'Complete FFE template for master bathroom with all essential fixtures',
      status: 'ACTIVE',
      isDefault: true,
      createdById: userId,
      updatedById: userId,
      sections: {
        create: Object.entries(SAMPLE_BATHROOM_ITEMS).map(([sectionName, items], sectionIndex) => ({
          name: sectionName,
          description: `${sectionName} items for bathroom`,
          order: sectionIndex + 1,
          items: {
            create: items.map(item => ({
              ...item,
              defaultState: item.isRequired ? 'SELECTED' : 'PENDING',
              estimatedCost: Math.floor(Math.random() * 2000) + 200, // Random cost for demo
            }))
          }
        }))
      }
    }
  })

  // Create kitchen template
  const kitchenTemplate = await prisma.fFETemplate.create({
    data: {
      orgId,
      roomType: 'KITCHEN',
      name: 'Standard Kitchen',
      description: 'Complete FFE template for kitchen with all essential items',
      status: 'ACTIVE',
      isDefault: true,
      createdById: userId,
      updatedById: userId,
      sections: {
        create: Object.entries(SAMPLE_KITCHEN_ITEMS).map(([sectionName, items], sectionIndex) => ({
          name: sectionName,
          description: `${sectionName} items for kitchen`,
          order: sectionIndex + 1,
          items: {
            create: items.map(item => ({
              ...item,
              defaultState: item.isRequired ? 'SELECTED' : 'PENDING',
              estimatedCost: Math.floor(Math.random() * 3000) + 300, // Random cost for demo
            }))
          }
        }))
      }
    }
  })
  
  console.log('✅ Created sample templates:', {
    bedroom: bedroomTemplate.id,
    bathroom: bathroomTemplate.id,
    kitchen: kitchenTemplate.id
  })
  
  return { bedroomTemplate, bathroomTemplate, kitchenTemplate }
}

// Main seed function
async function seedFFESystem() {
  try {
    console.log('🚀 Starting FFE System Seed...')
    
    // Seed section library first
    await seedFFESectionLibrary()
    
    // Find an organization and user to create sample templates
    const org = await prisma.organization.findFirst()
    const user = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'DESIGNER'] } }
    })
    
    if (!org || !user) {
      console.log('⚠️  No organization or admin/designer user found. Skipping sample templates.')
      return
    }
    
    console.log(`📋 Using org: ${org.name} (${org.id}) and user: ${user.name || user.email} (${user.id})`)
    
    // Create sample templates
    await seedSampleTemplates(org.id, user.id)
    
    console.log('🎉 FFE System seed completed successfully!')
    
  } catch (error) {
    console.error('❌ Error seeding FFE system:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Export for use in main seed file
export { seedFFESystem, seedFFESectionLibrary, seedSampleTemplates }

// Only run directly if this file is the entry point
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`
if (isMainModule) {
  seedFFESystem()
    .then(() => {
      console.log('✅ Seed completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error)
      process.exit(1)
    })
}
