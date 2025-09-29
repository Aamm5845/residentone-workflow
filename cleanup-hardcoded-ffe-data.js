const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function cleanupHardcodedFFEData() {
  console.log('🧹 Starting cleanup of all hardcoded FFE data...')

  try {
    // 1. Delete all room presets with hardcoded FFE items
    const roomPresets = await prisma.roomPreset.deleteMany({
      where: {
        isDefault: true
      }
    })
    console.log(`✅ Deleted ${roomPresets.count} default room presets`)

    // 2. Delete any FFE library items that might be hardcoded defaults
    // Look for common hardcoded item names
    const hardcodedItemNames = [
      'Soft Play Rug', 'Tiles', 'Paint', 'Spots', 'Fixture', 'LED',
      'Bathtub', 'Shower Kit', 'Faucet', 'Drain', 'Toilet',
      'Towel Bar', 'Tissue Holder', 'Hook', 'Towel Warmer',
      'King Size Bed Frame', 'Nightstands', 'Table Lamps', 'Dresser',
      'Sofa', 'Coffee Table', 'Area Rug', 'Window Treatments'
    ]

    const hardcodedLibraryItems = await prisma.fFELibraryItem.deleteMany({
      where: {
        name: {
          in: hardcodedItemNames
        }
      }
    })
    console.log(`✅ Deleted ${hardcodedLibraryItems.count} hardcoded library items`)

    // 3. Delete any FFE items in rooms that have hardcoded names
    const hardcodedRoomItems = await prisma.fFEItem.deleteMany({
      where: {
        name: {
          in: hardcodedItemNames
        }
      }
    })
    console.log(`✅ Deleted ${hardcodedRoomItems.count} hardcoded room FFE items`)

    // 4. Delete any FFE item statuses for items that no longer exist
    const orphanedStatuses = await prisma.fFEItemStatus.deleteMany({
      where: {
        itemId: {
          in: hardcodedItemNames.map(name => name.toLowerCase().replace(/\s+/g, '_'))
        }
      }
    })
    console.log(`✅ Deleted ${orphanedStatuses.count} orphaned FFE item statuses`)

    // 5. Look for any categories that might have hardcoded items
    const hardcodedCategories = [
      'Lighting', 'Plumbing', 'Flooring', 'Furniture', 'Accessories',
      'Wall', 'Ceiling', 'Doors and Handles', 'Moulding', 'Electric'
    ]

    // Delete library items in hardcoded categories that were auto-created
    const categoryBasedItems = await prisma.fFELibraryItem.deleteMany({
      where: {
        AND: [
          {
            category: {
              in: hardcodedCategories
            }
          },
          {
            // Only delete items that were likely auto-created (no custom creator)
            OR: [
              { createdBy: null },
              { notes: null },
              { notes: '' }
            ]
          }
        ]
      }
    })
    console.log(`✅ Deleted ${categoryBasedItems.count} auto-created category items`)

    console.log('🎉 Cleanup completed! All hardcoded FFE data has been removed.')
    console.log('📝 The system is now completely user-managed.')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupHardcodedFFEData()