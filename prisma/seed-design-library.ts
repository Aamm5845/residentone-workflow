import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Universal Design Concept Item Library
// This library applies to ALL room types - Aaron can pick and choose what's relevant per room
const DESIGN_LIBRARY = [
  // FURNITURE CATEGORY
  {
    category: 'furniture',
    categoryName: 'Furniture',
    items: [
      { name: 'Sofa', icon: 'Sofa', description: 'Living room seating' },
      { name: 'Chair', icon: 'Armchair', description: 'Accent or dining chairs' },
      { name: 'Armchair', icon: 'Armchair', description: 'Comfortable seating' },
      { name: 'Coffee Table', icon: 'Coffee', description: 'Center table' },
      { name: 'Side Table', icon: 'Table', description: 'End or side tables' },
      { name: 'Console Table', icon: 'LayoutDashboard', description: 'Entry or hallway' },
      { name: 'Dining Table', icon: 'Table', description: 'Main dining surface' },
      { name: 'Dining Chairs', icon: 'Armchair', description: 'Dining seating' },
      { name: 'Bed', icon: 'Bed', description: 'Bedroom bed frame' },
      { name: 'Nightstand', icon: 'Table', description: 'Bedside table' },
      { name: 'Dresser', icon: 'Box', description: 'Clothing storage' },
      { name: 'Desk', icon: 'Laptop', description: 'Work surface' },
      { name: 'Office Chair', icon: 'Armchair', description: 'Desk chair' },
      { name: 'Bookshelf', icon: 'BookOpen', description: 'Book storage' },
      { name: 'TV Stand', icon: 'Tv', description: 'Media console' },
      { name: 'Bench', icon: 'RectangleHorizontal', description: 'Seating bench' },
      { name: 'Ottoman', icon: 'Square', description: 'Footrest or seating' },
      { name: 'Bar Stool', icon: 'Armchair', description: 'Counter seating' },
    ]
  },
  
  // PLUMBING FIXTURES
  {
    category: 'plumbing',
    categoryName: 'Plumbing Fixtures',
    items: [
      { name: 'Faucet', icon: '🚰', description: 'Sink faucet' },
      { name: 'Sink', icon: '🚰', description: 'Basin or wash basin' },
      { name: 'Vanity', icon: '🚿', description: 'Bathroom vanity unit' },
      { name: 'Toilet', icon: '🚽', description: 'Water closet' },
      { name: 'Shower', icon: '🚿', description: 'Shower system' },
      { name: 'Bathtub', icon: '🛁', description: 'Soaking tub' },
      { name: 'Shower Head', icon: '💧', description: 'Shower fixture' },
      { name: 'Shower Door', icon: '🚪', description: 'Glass enclosure' },
      { name: 'Towel Bar', icon: '🧴', description: 'Towel rack' },
      { name: 'Toilet Paper Holder', icon: '🧻', description: 'TP holder' },
      { name: 'Kitchen Sink', icon: '🚰', description: 'Kitchen basin' },
      { name: 'Laundry Sink', icon: '🧺', description: 'Utility sink' },
    ]
  },
  
  // LIGHTING
  {
    category: 'lighting',
    categoryName: 'Lighting',
    items: [
      { name: 'Pendant Light', icon: '💡', description: 'Hanging fixture' },
      { name: 'Chandelier', icon: '✨', description: 'Statement lighting' },
      { name: 'Sconce', icon: '🕯️', description: 'Wall light' },
      { name: 'Table Lamp', icon: '🛋️', description: 'Portable lighting' },
      { name: 'Floor Lamp', icon: '💡', description: 'Standing lamp' },
      { name: 'Ceiling Light', icon: '💡', description: 'Flush mount' },
      { name: 'Recessed Lighting', icon: '🔦', description: 'Can lights' },
      { name: 'Track Lighting', icon: '💡', description: 'Adjustable spots' },
      { name: 'Under Cabinet Lighting', icon: '💡', description: 'Task lighting' },
      { name: 'Vanity Light', icon: '💄', description: 'Bathroom lighting' },
    ]
  },
  
  // TEXTILES & SOFT GOODS
  {
    category: 'textiles',
    categoryName: 'Textiles & Soft Goods',
    items: [
      { name: 'Curtains', icon: '🪟', description: 'Window treatments' },
      { name: 'Drapes', icon: '🪟', description: 'Heavy window coverings' },
      { name: 'Blinds', icon: '🪟', description: 'Window shades' },
      { name: 'Rug', icon: '🧶', description: 'Area rug' },
      { name: 'Bedding', icon: '🛏️', description: 'Bed linens' },
      { name: 'Throw Pillows', icon: '🎨', description: 'Decorative cushions' },
      { name: 'Throw Blanket', icon: '🧣', description: 'Accent blanket' },
      { name: 'Towels', icon: '🧴', description: 'Bath towels' },
      { name: 'Upholstery', icon: '🪑', description: 'Fabric selection' },
    ]
  },
  
  // DECOR & ACCESSORIES
  {
    category: 'decor',
    categoryName: 'Decor & Accessories',
    items: [
      { name: 'Mirror', icon: '🪞', description: 'Wall or decorative mirror' },
      { name: 'Artwork', icon: '🖼️', description: 'Wall art or painting' },
      { name: 'Sculpture', icon: '🗿', description: 'Decorative object' },
      { name: 'Vase', icon: '🏺', description: 'Decorative vessel' },
      { name: 'Plant', icon: '🪴', description: 'Indoor greenery' },
      { name: 'Clock', icon: '🕐', description: 'Wall or table clock' },
      { name: 'Decorative Bowl', icon: '🥣', description: 'Accent piece' },
      { name: 'Candles', icon: '🕯️', description: 'Decorative candles' },
      { name: 'Photo Frame', icon: '🖼️', description: 'Picture frame' },
      { name: 'Decorative Tray', icon: '🍽️', description: 'Styling tray' },
    ]
  },
  
  // APPLIANCES
  {
    category: 'appliances',
    categoryName: 'Appliances',
    items: [
      { name: 'Refrigerator', icon: '🧊', description: 'Kitchen fridge' },
      { name: 'Range', icon: '🔥', description: 'Stove and oven' },
      { name: 'Dishwasher', icon: '🍽️', description: 'Built-in dishwasher' },
      { name: 'Microwave', icon: '📻', description: 'Microwave oven' },
      { name: 'Range Hood', icon: '💨', description: 'Ventilation hood' },
      { name: 'Wine Cooler', icon: '🍷', description: 'Wine refrigerator' },
      { name: 'Washer', icon: '🧺', description: 'Washing machine' },
      { name: 'Dryer', icon: '🌀', description: 'Clothes dryer' },
    ]
  },
  
  // HARDWARE & FINISHES
  {
    category: 'hardware',
    categoryName: 'Hardware & Details',
    items: [
      { name: 'Door Handle', icon: '🚪', description: 'Door lever or knob' },
      { name: 'Cabinet Hardware', icon: '🔩', description: 'Pulls and knobs' },
      { name: 'Cabinet Pull', icon: '🔧', description: 'Drawer pulls' },
      { name: 'Hinges', icon: '🔨', description: 'Door hinges' },
      { name: 'Switch Plate', icon: '💡', description: 'Light switch cover' },
      { name: 'Outlet Cover', icon: '🔌', description: 'Electrical plate' },
      { name: 'Curtain Rod', icon: '🪟', description: 'Drapery hardware' },
      { name: 'Hooks', icon: '🪝', description: 'Wall hooks' },
    ]
  },
  
  // MATERIALS & FINISHES
  {
    category: 'materials',
    categoryName: 'Materials & Finishes',
    items: [
      { name: 'Paint Color', icon: 'Paintbrush', description: 'Wall paint selection' },
      { name: 'Wallpaper', icon: 'FileImage', description: 'Wall covering' },
      { name: 'Tile', icon: 'Grid3x3', description: 'Floor or wall tile' },
      { name: 'Backsplash', icon: 'Square', description: 'Kitchen or bath tile' },
      { name: 'Flooring', icon: 'Layers', description: 'Floor material' },
      { name: 'Countertop', icon: 'Table2', description: 'Surface material' },
      { name: 'Cabinet Finish', icon: 'Box', description: 'Cabinet color/stain' },
      { name: 'Trim Molding', icon: 'Frame', description: 'Baseboards and crown' },
    ]
  },
  
  // GENERAL - Plans & Documents
  {
    category: 'general',
    categoryName: 'Plans & Documents',
    items: [
      { name: 'Floor Plans', icon: 'LayoutGrid', description: 'Room layout drawings' },
      { name: 'Elevations', icon: 'Layers', description: 'Wall elevation drawings' },
      { name: 'Sections', icon: 'RectangleVertical', description: 'Section cut drawings' },
      { name: 'Details', icon: 'ZoomIn', description: 'Detail drawings' },
      { name: 'Specifications', icon: 'FileText', description: 'Project specifications' },
      { name: 'Material Schedule', icon: 'ListChecks', description: 'Materials list' },
      { name: 'Finish Schedule', icon: 'Palette', description: 'Finish selections' },
      { name: 'Door Schedule', icon: 'DoorClosed', description: 'Door types and locations' },
      { name: 'Window Schedule', icon: 'SquareDashed', description: 'Window types and locations' },
      { name: 'RCP (Ceiling Plan)', icon: 'Circle', description: 'Reflected ceiling plan' },
      { name: 'Lighting Plan', icon: 'Lightbulb', description: 'Lighting layout' },
      { name: 'Electrical Plan', icon: 'Zap', description: 'Electrical outlets and switches' },
      { name: 'Plumbing Plan', icon: 'Droplets', description: 'Plumbing fixtures and lines' },
    ]
  }
]

async function main() {
  console.log('🎨 Starting Design Concept Library Seed...\n')
  
  let totalCreated = 0
  let totalUpdated = 0
  
  for (const category of DESIGN_LIBRARY) {
    console.log(`📦 Seeding category: ${category.categoryName}`)
    
    let order = 0
    for (const item of category.items) {
      order++
      
      const existingItem = await prisma.designConceptItemLibrary.findFirst({
        where: {
          name: item.name,
          category: category.category
        }
      })
      
      if (existingItem) {
        await prisma.designConceptItemLibrary.update({
          where: { id: existingItem.id },
          data: {
            description: item.description,
            icon: item.icon,
            order,
            isActive: true
          }
        })
        totalUpdated++
        console.log(`  ↻ Updated: ${item.name}`)
      } else {
        await prisma.designConceptItemLibrary.create({
          data: {
            name: item.name,
            category: category.category,
            description: item.description,
            icon: item.icon,
            order,
            isActive: true
          }
        })
        totalCreated++
        console.log(`  ✓ Created: ${item.name}`)
      }
    }
    console.log(`  ${category.items.length} items processed\n`)
  }
  
  // Summary
  console.log('════════════════════════════════════════════════════')
  console.log('✅ Design Concept Library Seed Complete!')
  console.log(`📊 Created: ${totalCreated} items`)
  console.log(`↻ Updated: ${totalUpdated} items`)
  console.log(`📦 Total categories: ${DESIGN_LIBRARY.length}`)
  console.log('════════════════════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
