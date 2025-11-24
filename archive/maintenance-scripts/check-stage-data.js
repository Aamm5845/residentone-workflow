const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkStageData() {
  const stageId = 'cmgecc20f000f08fmmth5nbu3'
  
  console.log('Checking stage:', stageId)
  console.log('================================\n')
  
  // Get the stage
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      room: true
    }
  })
  
  if (!stage) {
    console.log('❌ Stage not found')
    return
  }
  
  console.log('✅ Stage found:')
  console.log('  Type:', stage.type)
  console.log('  Status:', stage.status)
  console.log('  Room:', stage.room?.name || stage.room?.type)
  console.log('\n================================\n')
  
  // Get design sections
  const sections = await prisma.designSection.findMany({
    where: { stageId },
    include: {
      assets: true,
      comments: {
        include: {
          author: true
        }
      }
    }
  })
  
  console.log(`Found ${sections.length} design sections:\n`)
  
  sections.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type}`)
    console.log(`   Completed: ${section.completed}`)
    console.log(`   Content: ${section.content ? section.content.substring(0, 100) + '...' : 'None'}`)
    console.log(`   Assets: ${section.assets.length}`)
    
    if (section.assets.length > 0) {
      section.assets.forEach((asset, j) => {
        console.log(`     ${j + 1}. ${asset.title}`)
        console.log(`        URL: ${asset.url}`)
        console.log(`        Type: ${asset.type}`)
        if (asset.userDescription) {
          console.log(`        Description: ${asset.userDescription.substring(0, 50)}...`)
        }
      })
    }
    
    console.log(`   Comments: ${section.comments.length}`)
    if (section.comments.length > 0) {
      section.comments.forEach((comment, j) => {
        console.log(`     ${j + 1}. ${comment.author.name}: ${comment.content.substring(0, 50)}...`)
      })
    }
    console.log('')
  })
  
  await prisma.$disconnect()
}

checkStageData().catch(console.error)
