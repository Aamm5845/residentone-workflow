const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyCleanSystem() {
  console.log('🔍 Verifying system is completely clean of hardcoded FFE data...')
  console.log('')

  try {
    // 1. Check room presets
    const roomPresets = await prisma.roomPreset.count({
      where: { isDefault: true }
    })
    console.log(`📋 Room Presets with hardcoded items: ${roomPresets}`)

    // 2. Check FFE library items
    const libraryItems = await prisma.fFELibraryItem.findMany({
      select: { name: true, category: true }
    })
    console.log(`📚 Total FFE Library Items: ${libraryItems.length}`)
    if (libraryItems.length > 0) {
      console.log('   Items found:')
      libraryItems.forEach(item => {
        console.log(`   - ${item.name} (${item.category})`)
      })
    }

    // 3. Check FFE items in rooms
    const roomFFEItems = await prisma.fFEItem.findMany({
      select: { name: true, category: true }
    })
    console.log(`🏠 Total Room FFE Items: ${roomFFEItems.length}`)
    if (roomFFEItems.length > 0) {
      console.log('   Items found:')
      roomFFEItems.forEach(item => {
        console.log(`   - ${item.name} (${item.category})`)
      })
    }

    // 4. Check FFE item statuses
    const ffeStatuses = await prisma.fFEItemStatus.count()
    console.log(`📊 Total FFE Item Statuses: ${ffeStatuses}`)

    // 5. Look for any suspicious patterns
    const hardcodedNames = [
      'Soft Play Rug', 'Tiles', 'Paint', 'Spots', 'Fixture', 'LED',
      'Bathtub', 'Shower Kit', 'Faucet', 'Drain', 'Toilet',
      'Towel Bar', 'Tissue Holder', 'Hook', 'Towel Warmer'
    ]

    const suspiciousLibraryItems = await prisma.fFELibraryItem.findMany({
      where: {
        name: { in: hardcodedNames }
      },
      select: { name: true, category: true }
    })

    const suspiciousRoomItems = await prisma.fFEItem.findMany({
      where: {
        name: { in: hardcodedNames }
      },
      select: { name: true, category: true }
    })

    console.log(`⚠️  Suspicious Library Items: ${suspiciousLibraryItems.length}`)
    suspiciousLibraryItems.forEach(item => {
      console.log(`   ⚠️  ${item.name} (${item.category})`)
    })

    console.log(`⚠️  Suspicious Room Items: ${suspiciousRoomItems.length}`)
    suspiciousRoomItems.forEach(item => {
      console.log(`   ⚠️  ${item.name} (${item.category})`)
    })

    console.log('')
    console.log('📝 VERIFICATION SUMMARY:')
    console.log(`   Default Room Presets: ${roomPresets}`)
    console.log(`   Library Items: ${libraryItems.length}`)
    console.log(`   Room FFE Items: ${roomFFEItems.length}`)
    console.log(`   Suspicious Items: ${suspiciousLibraryItems.length + suspiciousRoomItems.length}`)

    if (roomPresets === 0 && suspiciousLibraryItems.length === 0 && suspiciousRoomItems.length === 0) {
      console.log('')
      console.log('🎉 ✅ SYSTEM IS CLEAN!')
      console.log('   No hardcoded room presets, library items, or room items detected.')
      console.log('   All FFE data is now user-managed.')
    } else {
      console.log('')
      console.log('⚠️  SYSTEM MAY STILL HAVE HARDCODED DATA')
      console.log('   Some suspicious items were detected.')
    }

  } catch (error) {
    console.error('❌ Error during verification:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyCleanSystem()