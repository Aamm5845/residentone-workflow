const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function findAllDesignData() {
  console.log('Searching for ALL design sections with content or assets...\n')
  
  // Find sections with content
  const sectionsWithContent = await prisma.designSection.findMany({
    where: {
      content: {
        not: null
      }
    },
    include: {
      stage: {
        include: {
          room: {
            include: {
              project: {
                include: {
                  client: true
                }
              }
            }
          }
        }
      }
    }
  })
  
  console.log(`Found ${sectionsWithContent.length} sections with content:\n`)
  sectionsWithContent.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type}`)
    console.log(`   Stage ID: ${section.stageId}`)
    console.log(`   Room: ${section.stage.room.name || section.stage.room.type}`)
    console.log(`   Project: ${section.stage.room.project.name}`)
    console.log(`   Client: ${section.stage.room.project.client.name}`)
    console.log(`   Content: ${section.content?.substring(0, 100)}...`)
    console.log('')
  })
  
  // Find sections with assets
  const sectionsWithAssets = await prisma.designSection.findMany({
    where: {
      assets: {
        some: {}
      }
    },
    include: {
      assets: true,
      stage: {
        include: {
          room: {
            include: {
              project: {
                include: {
                  client: true
                }
              }
            }
          }
        }
      }
    }
  })
  
  console.log(`\nFound ${sectionsWithAssets.length} sections with assets:\n`)
  sectionsWithAssets.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type}`)
    console.log(`   Stage ID: ${section.stageId}`)
    console.log(`   Room: ${section.stage.room.name || section.stage.room.type}`)
    console.log(`   Project: ${section.stage.room.project.name}`)
    console.log(`   Client: ${section.stage.room.project.client.name}`)
    console.log(`   Assets: ${section.assets.length}`)
    section.assets.forEach((asset, j) => {
      console.log(`     ${j + 1}. ${asset.title} (${asset.type})`)
    })
    console.log('')
  })
  
  await prisma.$disconnect()
}

findAllDesignData().catch(console.error)
