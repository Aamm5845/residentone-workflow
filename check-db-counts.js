const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCounts() {
  try {
    const [projects, users, orgs, rooms] = await Promise.all([
      prisma.project.count(),
      prisma.user.count(),
      prisma.organization.count(),
      prisma.room.count()
    ])
    
    console.log('📊 Current Database:')
    console.log('Projects:', projects)
    console.log('Users:', users)
    console.log('Orgs:', orgs)
    console.log('Rooms:', rooms)
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkCounts()
