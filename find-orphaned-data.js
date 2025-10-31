const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function findOrphanedData() {
  const stageId = 'cmgecc20f000f08fmmth5nbu3'
  
  console.log('Searching for orphaned/deleted data for stage:', stageId)
  console.log('================================\n')
  
  // Check for assets without a section (deleted sections)
  const orphanedAssets = await prisma.asset.findMany({
    where: {
      section: {
        stageId: stageId
      }
    },
    include: {
      section: true
    }
  })
  
  console.log(`Found ${orphanedAssets.length} assets linked to this stage's sections\n`)
  
  if (orphanedAssets.length > 0) {
    orphanedAssets.forEach((asset, i) => {
      console.log(`${i + 1}. ${asset.title}`)
      console.log(`   Section: ${asset.section?.type || 'ORPHANED'}`)
      console.log(`   URL: ${asset.url}`)
      console.log(`   Type: ${asset.type}`)
      if (asset.userDescription) {
        console.log(`   Description: ${asset.userDescription}`)
      }
      console.log(`   Created: ${asset.createdAt}`)
      console.log('')
    })
  }
  
  // Check for comments
  const orphanedComments = await prisma.comment.findMany({
    where: {
      section: {
        stageId: stageId
      }
    },
    include: {
      author: true,
      section: true
    }
  })
  
  console.log(`\nFound ${orphanedComments.length} comments linked to this stage's sections\n`)
  
  if (orphanedComments.length > 0) {
    orphanedComments.forEach((comment, i) => {
      console.log(`${i + 1}. ${comment.author.name}`)
      console.log(`   Section: ${comment.section?.type || 'ORPHANED'}`)
      console.log(`   Content: ${comment.content}`)
      console.log(`   Created: ${comment.createdAt}`)
      console.log('')
    })
  }
  
  // Check if there's a GENERAL section that was deleted
  const allSections = await prisma.designSection.findMany({
    where: { stageId },
    orderBy: { createdAt: 'asc' }
  })
  
  console.log(`\nAll sections for this stage:`)
  allSections.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type} (ID: ${section.id})`)
    console.log(`   Created: ${section.createdAt}`)
    console.log(`   Updated: ${section.updatedAt}`)
  })
  
  await prisma.$disconnect()
}

findOrphanedData().catch(console.error)
