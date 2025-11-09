import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Intelligent mapping of item names to Lucide icon names
const NAME_TO_ICON_MAP: Record<string, string> = {
  // Furniture
  'Sofa': 'Sofa',
  'Chair': 'Armchair',
  'Armchair': 'Armchair',
  'Coffee Table': 'Coffee',
  'Side Table': 'Table',
  'Console Table': 'Table',
  'Dining Table': 'UtensilsCrossed',
  'Dining Chairs': 'Armchair',
  'Bed': 'Bed',
  'Nightstand': 'Moon',
  'Dresser': 'Shirt',
  'Desk': 'Laptop',
  'Office Chair': 'Armchair',
  'Bookshelf': 'BookOpen',
  'TV Stand': 'Tv',
  'Bench': 'RectangleHorizontal',
  'Ottoman': 'Square',
  'Bar Stool': 'Wine',
  
  // Plumbing
  'Faucet': 'Droplet',
  'Sink': 'Droplets',
  'Vanity': 'Bath',
  'Toilet': 'Bath',
  'Shower': 'Droplets',
  'Bathtub': 'Bath',
  'Shower Head': 'Droplet',
  'Shower Door': 'DoorOpen',
  'Towel Bar': 'Maximize2',
  'Toilet Paper Holder': 'Circle',
  'Kitchen Sink': 'Droplets',
  'Laundry Sink': 'Droplets',
  
  // Lighting
  'Pendant Light': 'Lightbulb',
  'Chandelier': 'Sparkles',
  'Sconce': 'Flame',
  'Table Lamp': 'Lamp',
  'Floor Lamp': 'Lamp',
  'Ceiling Light': 'Lightbulb',
  'Recessed Lighting': 'Circle',
  'Track Lighting': 'Lightbulb',
  'Under Cabinet Lighting': 'Lightbulb',
  'Vanity Light': 'Lightbulb',
  
  // Textiles
  'Curtains': 'Blinds',
  'Drapes': 'Blinds',
  'Blinds': 'Blinds',
  'Rug': 'Square',
  'Bedding': 'Bed',
  'Throw Pillows': 'Hexagon',
  'Throw Blanket': 'Waves',
  'Towels': 'Maximize2',
  'Upholstery': 'Armchair',
  
  // Decor
  'Mirror': 'Mirror',
  'Artwork': 'Frame',
  'Sculpture': 'Box',
  'Vase': 'FlaskConical',
  'Plant': 'Flower',
  'Clock': 'Clock',
  'Decorative Bowl': 'Circle',
  'Candles': 'Flame',
  'Photo Frame': 'Frame',
  'Decorative Tray': 'RectangleHorizontal',
  
  // Appliances
  'Refrigerator': 'Refrigerator',
  'Range': 'Flame',
  'Dishwasher': 'Waves',
  'Microwave': 'Box',
  'Range Hood': 'Wind',
  'Wine Cooler': 'Wine',
  'Washer': 'WashingMachine',
  'Dryer': 'Wind',
  
  // Hardware
  'Door Handle': 'DoorOpen',
  'Cabinet Hardware': 'Settings',
  'Cabinet Pull': 'Minus',
  'Hinges': 'Settings',
  'Switch Plate': 'ToggleRight',
  'Outlet Cover': 'Plug',
  'Curtain Rod': 'Minus',
  'Hooks': 'Circle',
  
  // Materials
  'Paint Color': 'Palette',
  'Wallpaper': 'Wallpaper',
  'Tile': 'Square',
  'Backsplash': 'LayoutGrid',
  'Flooring': 'Layers',
  'Countertop': 'RectangleHorizontal',
  'Cabinet Finish': 'Box',
  'Trim Molding': 'Ruler',
}

async function assignIcons() {
  console.log('🎨 Assigning Lucide icons based on item names...\n')

  try {
    const items = await prisma.designConceptItemLibrary.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
      }
    })

    console.log(`📊 Found ${items.length} library items\n`)

    let updatedCount = 0
    let notFoundCount = 0

    for (const item of items) {
      const lucideIcon = NAME_TO_ICON_MAP[item.name]

      if (lucideIcon) {
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: lucideIcon }
        })
        console.log(`✅ ${item.name} → ${lucideIcon}`)
        updatedCount++
      } else {
        // Set to Package if no mapping found
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: 'Package' }
        })
        console.log(`⚠️  ${item.name} → Package (no mapping found)`)
        notFoundCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✨ Icon Assignment Complete!\n')
    console.log(`📊 Summary:`)
    console.log(`   ✅ Mapped: ${updatedCount}`)
    console.log(`   ⚠️  Default (Package): ${notFoundCount}`)
    console.log(`   📦 Total: ${items.length}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ Error assigning icons:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
assignIcons()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
