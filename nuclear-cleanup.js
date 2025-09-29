const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function nuclearCleanup() {
  console.log('💥 NUCLEAR CLEANUP: Removing ALL FFE items and statuses...')
  console.log('')

  try {
    // 1. Delete ALL FFE item statuses
    const deletedStatuses = await prisma.fFEItemStatus.deleteMany({})
    console.log(`✅ Deleted ${deletedStatuses.count} FFE item statuses`)

    // 2. Delete ALL room FFE items
    const deletedRoomItems = await prisma.fFEItem.deleteMany({})
    console.log(`✅ Deleted ${deletedRoomItems.count} room FFE items`)

    // 3. Delete ALL bathroom states
    const deletedBathroomStates = await prisma.fFEBathroomState.deleteMany({})
    console.log(`✅ Deleted ${deletedBathroomStates.count} bathroom FFE states`)

    // 4. Delete ALL library items (keep only user-created room types and categories if needed)
    const libraryItems = await prisma.fFELibraryItem.findMany({
      select: { id: true, name: true, itemType: true }
    })

    let deletedLibraryItems = 0
    for (const item of libraryItems) {
      // Delete everything - even custom ones since you want a completely clean slate
      await prisma.fFELibraryItem.delete({ where: { id: item.id } })
      deletedLibraryItems++
      console.log(`   - Deleted: ${item.name} (${item.itemType || 'ITEM'})`)
    }
    console.log(`✅ Deleted ${deletedLibraryItems} library items`)

    // 5. Delete ALL room presets
    const deletedPresets = await prisma.roomPreset.deleteMany({})
    console.log(`✅ Deleted ${deletedPresets.count} room presets`)

    console.log('')
    console.log('🎉 NUCLEAR CLEANUP COMPLETE!')
    console.log('   - 0 FFE items remain')
    console.log('   - 0 FFE statuses remain') 
    console.log('   - 0 library items remain')
    console.log('   - 0 room presets remain')
    console.log('')
    console.log('🔥 Your system is now COMPLETELY EMPTY and ready for 100% user-managed content!')

  } catch (error) {
    console.error('❌ Error during nuclear cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

nuclearCleanup()