const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function finalCleanup() {
  console.log('🧹 Final cleanup of any remaining hardcoded FFE data...')

  try {
    // Get all library items and check for hardcoded names
    const allLibraryItems = await prisma.fFELibraryItem.findMany({
      select: {
        id: true,
        name: true,
        category: true
      }
    })

    console.log(`Found ${allLibraryItems.length} library items total`)

    // Filter hardcoded ones
    const hardcodedNames = [
      'Soft Play Rug', 'Tiles', 'Paint', 'Spots', 'Fixture', 'LED',
      'Bathtub', 'Shower Kit', 'Faucet', 'Drain', 'Toilet',
      'Towel Bar', 'Tissue Holder', 'Hook', 'Towel Warmer'
    ]

    const hardcodedItems = allLibraryItems.filter(item => 
      hardcodedNames.includes(item.name)
    )

    if (hardcodedItems.length > 0) {
      console.log(`Found ${hardcodedItems.length} hardcoded library items:`)
      hardcodedItems.forEach(item => {
        console.log(`- ${item.name} (${item.category})`)
      })

      // Delete them
      for (const item of hardcodedItems) {
        await prisma.fFELibraryItem.delete({
          where: { id: item.id }
        })
      }
      console.log(`✅ Deleted ${hardcodedItems.length} hardcoded library items`)
    } else {
      console.log('✅ No hardcoded library items found')
    }

    console.log('🎉 Final cleanup completed!')
    
  } catch (error) {
    console.error('❌ Error during final cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

finalCleanup()