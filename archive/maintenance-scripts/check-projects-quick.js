const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkProjects() {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true
      },
      take: 10
    })
    
    console.log('✅ Total Projects:', projects.length)
    console.log('\nProjects:')
    console.log(JSON.stringify(projects, null, 2))
    
  } catch (error) {
    console.error('❌ ERROR:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkProjects()
