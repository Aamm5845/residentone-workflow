const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkExactContent() {
  const stageId = 'cmgecc20f000f08fmmth5nbu3'
  
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
  
  console.log(`Checking exact content for ${sections.length} sections:\n`)
  
  sections.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type}`)
    console.log(`   ID: ${section.id}`)
    console.log(`   Completed: ${section.completed}`)
    console.log(`   Content (${section.content ? section.content.length : 0} chars):`)
    console.log(`   "${section.content}"`)
    console.log(`   Assets: ${section.assets.length}`)
    console.log(`   Comments: ${section.comments.length}`)
    console.log(`   Created: ${section.createdAt}`)
    console.log(`   Updated: ${section.updatedAt}`)
    console.log('')
  })
  
  await prisma.$disconnect()
}

checkExactContent().catch(console.error)
