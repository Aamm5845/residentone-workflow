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

async function migrateIcons() {
  console.log('🔄 Starting icon migration from emojis to Lucide icons...\n')

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

    let updatedCount = 0
    let skippedCount = 0
    let notFoundCount = 0

    for (const item of items) {
      const currentIcon = item.icon

      // Skip if already a Lucide icon name (starts with uppercase letter)
      if (currentIcon && /^[A-Z]/.test(currentIcon)) {
        console.log(`⏭️  Skipped: ${item.name} (already has icon: ${currentIcon})`)
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
        console.log(`✅ Updated: ${item.name}  ${currentIcon} → ${lucideIcon}`)
        updatedCount++
      } else if (currentIcon) {
        // Set to Package if emoji not found in mapping
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: 'Package' }
        })
        console.log(`⚠️  Not found: ${item.name}  ${currentIcon} → Package (default)`)
        notFoundCount++
      } else {
        // No icon at all, set to Package
        await prisma.designConceptItemLibrary.update({
          where: { id: item.id },
          data: { icon: 'Package' }
        })
        console.log(`🆕 Empty: ${item.name} → Package (default)`)
        notFoundCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✨ Migration Complete!\n')
    console.log(`📊 Summary:`)
    console.log(`   ✅ Updated: ${updatedCount}`)
    console.log(`   ⏭️  Skipped (already Lucide): ${skippedCount}`)
    console.log(`   ⚠️  Set to default: ${notFoundCount}`)
    console.log(`   📦 Total: ${items.length}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateIcons()
  .then(() => {
    console.log('\n✅ Migration script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error)
    process.exit(1)
  })
