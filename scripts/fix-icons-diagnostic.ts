import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapping of common emojis to Lucide icon names
const EMOJI_TO_ICON_MAP: Record<string, string> = {
  '🛋️': 'Sofa',
  '🛋': 'Sofa',
  '🪑': 'Armchair',
  '💡': 'Lightbulb',
  '🛏️': 'Bed',
  '🛏': 'Bed',
  '🛁': 'Bath',
  '🚿': 'Droplet',
  '🔥': 'Flame',
  '💨': 'Wind',
  '🌡️': 'Thermometer',
  '🌡': 'Thermometer',
  '⏰': 'Clock',
  '🪞': 'Mirror',
  '🖼️': 'Frame',
  '🖼': 'Frame',
  '🖌️': 'Paintbrush',
  '🖌': 'Paintbrush',
  '✨': 'Sparkles',
  '🌸': 'Flower',
  '🌳': 'Trees',
  '🍃': 'Leaf',
  '📺': 'Tv',
  '🖥️': 'Monitor',
  '🖥': 'Monitor',
  '📱': 'Phone',
  '🔊': 'Speaker',
  '🎵': 'Music',
  '☕': 'Coffee',
  '🍷': 'Wine',
  '🍽️': 'UtensilsCrossed',
  '🍽': 'UtensilsCrossed',
  '🍳': 'CookingPot',
  '❄️': 'Refrigerator',
  '❄': 'Refrigerator',
  '🌊': 'WashingMachine',
  '⚡': 'Microwave',
  '🪭': 'Fan',
  '☀️': 'Sun',
  '☀': 'Sun',
  '🌙': 'Moon',
  '⭐': 'Star',
  '🏠': 'Home',
  '🏢': 'Building',
  '🚪': 'Door',
  '🪟': 'Window',
  '🪜': 'Fence',
  '📏': 'Ruler',
  '✏️': 'Pencil',
  '✏': 'Pencil',
  '🎨': 'Palette',
  '🔨': 'Hammer',
  '🔧': 'Wrench',
  '⚙️': 'Settings',
  '⚙': 'Settings',
  '📦': 'Package',
  '📁': 'FolderOpen',
  '💐': 'Flower2',
  '❤️': 'Heart',
  '❤': 'Heart',
  '🎁': 'Gift',
  '🏆': 'Trophy',
  '👑': 'Crown',
  '💎': 'Diamond',
  '👔': 'Shirt',
  '💼': 'Briefcase',
  '🎒': 'Backpack',
  '🛍️': 'ShoppingBag',
  '🛍': 'ShoppingBag',
  '🛒': 'ShoppingCart',
  '🧱': 'Wallpaper',
  '🎭': 'Baseline',
  '🖍️': 'Brush',
  '🖍': 'Brush',
}

async function fixIcons() {
  console.log('🔍 Checking icon values in database...\n')

  try {
    // Get all library items
    const items = await prisma.designConceptItemLibrary.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
      }
    })

    console.log(`📊 Found ${items.length} library items\n`)

    if (items.length === 0) {
      console.log('⚠️  No items found. The library might be empty.')
      return
    }

    let updatedCount = 0
    let skippedCount = 0
    let notFoundCount = 0

    for (const item of items) {
      const currentIcon = item.icon
      console.log(`\nChecking: ${item.name}`)
      console.log(`  Current icon: "${currentIcon}" (length: ${currentIcon?.length || 0})`)
      
      // Show hex codes for debugging
      if (currentIcon) {
        const hexCodes = Array.from(currentIcon).map(char => 
          '0x' + char.charCodeAt(0).toString(16).padStart(4, '0')
        ).join(' ')
        console.log(`  Hex codes: ${hexCodes}`)
      }

      // Skip if already a Lucide icon name (starts with uppercase letter)
      if (currentIcon && /^[A-Z][a-zA-Z0-9]*$/.test(currentIcon)) {
        console.log(`  ✅ Already a Lucide icon`)
        skippedCount++
        continue
      }

      // Try to find mapping
      const lucideIcon = currentIcon ? EMOJI_TO_ICON_MAP[currentIcon] : null

      if (lucideIcon) {
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: lucideIcon }
        })
        console.log(`  ✅ Updated: ${currentIcon} → ${lucideIcon}`)
        updatedCount++
      } else if (currentIcon) {
        // Set to Package if emoji not found in mapping
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: 'Package' }
        })
        console.log(`  ⚠️  Not found in mapping: ${currentIcon} → Package (default)`)
        notFoundCount++
      } else {
        // No icon at all, set to Package
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: 'Package' }
        })
        console.log(`  🆕 Empty → Package (default)`)
        notFoundCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✨ Fix Complete!\n')
    console.log(`📊 Summary:`)
    console.log(`   ✅ Updated: ${updatedCount}`)
    console.log(`   ⏭️  Skipped (already Lucide): ${skippedCount}`)
    console.log(`   ⚠️  Set to default: ${notFoundCount}`)
    console.log(`   📦 Total: ${items.length}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ Error during fix:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run fix
fixIcons()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
